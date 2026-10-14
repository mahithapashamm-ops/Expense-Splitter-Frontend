import { useEffect, useMemo, useState } from "react";
import axios from "axios";



const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/+$/, "");
const API_URL = `${API_BASE_URL}/api/auth`;

const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});

const read = (key, fallback) => {

  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }

};



export default function App() {

  const [user, setUser] = useState(() => read("es_user", null));

  const [token, setToken] = useState(() => localStorage.getItem("es_token") || "");

  const [isLogin, setIsLogin] = useState(true);

  const [auth, setAuth] = useState({ name: "", email: "", password: "" });

  const [authMessage, setAuthMessage] = useState("");

  const [busy, setBusy] = useState(false);

  const [groups, setGroups] = useState(() => read("es_groups", []));

  const [active, setActive] = useState(null);

  const [page, setPage] = useState("Dashboard");

  const [modal, setModal] = useState("");

  const [groupName, setGroupName] = useState("");

  const [memberName, setMemberName] = useState("");

  const [memberEmail, setMemberEmail] = useState("");

  const [expense, setExpense] = useState({ title: "", amount: "", paidBy: "", split: "equal", custom: "" });

  const [settle, setSettle] = useState({ from: "", to: "", amount: "" });

  const [notice, setNotice] = useState("");



  useEffect(() => localStorage.setItem("es_groups", JSON.stringify(groups)), [groups]);



  const totalExpenses = groups.reduce((sum, g) => sum + g.expenses.reduce((s, e) => s + e.amount, 0), 0);

  const selectedGroup = groups.find(g => g.id === active);

  const balances = useMemo(() => {

    if (!selectedGroup) return [];

    const map = {};

    selectedGroup.members.forEach(m => map[m.name] = 0);

    selectedGroup.expenses.forEach(e => {

      const shares = e.shares || {};

      map[e.paidBy] = (map[e.paidBy] || 0) + e.amount;

      Object.entries(shares).forEach(([name, value]) => map[name] = (map[name] || 0) - value);

    });

    selectedGroup.settlements.forEach(s => {

      map[s.from] = (map[s.from] || 0) + s.amount;

      map[s.to] = (map[s.to] || 0) - s.amount;

    });

    return Object.entries(map).map(([name, amount]) => ({ name, amount }));

  }, [selectedGroup]);



  async function submitAuth(e) {

    e.preventDefault(); setBusy(true); setAuthMessage("");

    try {

      const result = await axios.post(`${API_URL}/${isLogin ? "login" : "register"}`, isLogin

        ? { email: auth.email, password: auth.password }

        : { name: auth.name, email: auth.email, password: auth.password });

      const data = result.data;

      localStorage.setItem("es_token", data.token);

      localStorage.setItem("es_user", JSON.stringify(data));

      setToken(data.token); setUser(data); setNotice("You're signed in successfully.");

    } catch (err) {

      const body = err.response?.data;

      setAuthMessage(
        typeof body === "string" ? body : body?.message ||
        "Unable to connect to the server. Please try again."
      );

    } finally { setBusy(false); }

  }



  function logout() {

    localStorage.removeItem("es_token"); localStorage.removeItem("es_user");

    setToken(""); setUser(null); setPage("Dashboard"); setActive(null);

  }



  function createGroup(e) {

    e.preventDefault();

    if (!groupName.trim()) return;

    const group = { id: crypto.randomUUID(), name: groupName.trim(), members: [{name: user?.name || "You", email: user?.email || ""}], expenses: [], settlements: [] };

    setGroups(prev => [group, ...prev]); setActive(group.id); setGroupName(""); setModal(""); setPage("Group"); setNotice("Group created.");

  }



  function addMember(e) {

    e.preventDefault();

    if (!selectedGroup || !memberName.trim()) return;

    if (selectedGroup.members.some(m => m.email && m.email.toLowerCase() === memberEmail.toLowerCase())) {

      setNotice("That email is already in this group."); return;

    }

    updateGroup(selectedGroup.id, g => ({...g, members: [...g.members, {name: memberName.trim(), email: memberEmail.trim()}]}));

    setMemberName(""); setMemberEmail(""); setModal(""); setNotice("Member added.");

  }



  function addExpense(e) {

    e.preventDefault();

    if (!selectedGroup) return;

    const amount = Number(expense.amount);

    if (!expense.title.trim() || amount <= 0 || !expense.paidBy) return;

    const members = selectedGroup.members.map(m => m.name);

    let shares = {};

    if (expense.split === "custom") {

      const values = expense.custom.split(",").map(Number);

      if (values.length !== members.length || values.some(v => !Number.isFinite(v) || v < 0) || Math.abs(values.reduce((a,b)=>a+b,0)-amount) > 0.01) {

        setNotice("Enter one custom share per member, in member order, adding up to the total."); return;

      }

      members.forEach((name, i) => shares[name] = values[i]);

    } else {

      const each = Math.round((amount / members.length) * 100) / 100;

      let assigned = 0;

      members.forEach((name, i) => { const share = i === members.length - 1 ? Math.round((amount-assigned)*100)/100 : each; shares[name] = share; assigned += share; });

    }

    updateGroup(selectedGroup.id, g => ({...g, expenses: [{id: crypto.randomUUID(), title: expense.title.trim(), amount, paidBy: expense.paidBy, shares, date: new Date().toLocaleDateString()}, ...g.expenses]}));

    setExpense({title:"", amount:"", paidBy:"", split:"equal", custom:""}); setModal(""); setNotice("Expense added.");

  }



  function updateGroup(id, fn) { setGroups(prev => prev.map(g => g.id === id ? fn(g) : g)); }



  function addSettlement(e) {

    e.preventDefault();

    if (!selectedGroup || !settle.from || !settle.to || settle.from === settle.to || Number(settle.amount) <= 0) return;

    updateGroup(selectedGroup.id, g => ({...g, settlements: [{...settle, amount:Number(settle.amount), id:crypto.randomUUID()}, ...g.settlements]}));

    setSettle({from:"",to:"",amount:""}); setModal(""); setNotice("Settlement recorded.");

  }



  if (!token || !user) return (

    <main className="auth-shell">

      <div className="auth-art"><div className="brand-mark">₹</div><span className="eyebrow">LESS MATH. MORE MEMORIES.</span><h1>Good times are better when expenses are <em>shared.</em></h1><p>Keep group spending simple, fair, and stress-free.</p><div className="art-stats"><div><b>01</b><span>Create a group</span></div><div><b>02</b><span>Add expenses</span></div><div><b>03</b><span>Settle up</span></div></div></div>

      <div className="auth-panel"><div className="mobile-brand">₹ Expense Splitter</div><div className="auth-box"><div className="eyebrow purple">YOUR MONEY, MADE SIMPLE</div><h2>{isLogin ? "Welcome back" : "Create your account"}</h2><p className="muted">{isLogin ? "Sign in to pick up where you left off." : "Start splitting expenses with your people."}</p>

        <div className="auth-switch"><button className={isLogin?"selected":""} onClick={()=>{setIsLogin(true);setAuthMessage("");}}>Login</button><button className={!isLogin?"selected":""} onClick={()=>{setIsLogin(false);setAuthMessage("");}}>Register</button></div>

        <form onSubmit={submitAuth} className="stack">

          {!isLogin && <label>Full name<input required maxLength="100" placeholder="e.g. Priya Sharma" value={auth.name} onChange={e=>setAuth({...auth,name:e.target.value})}/></label>}

          <label>Email address<input required type="email" placeholder="you@example.com" value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})}/></label>

          <label>Password<input required minLength="8" type="password" placeholder="At least 8 characters" value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})}/></label>

          <button className="primary wide" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Sign in →" : "Create account →"}</button>

        </form>{authMessage && <div className="alert">{authMessage}</div>}<p className="fineprint">Your account is authenticated by the Expense Splitter API.</p></div></div>

    </main>

  );



  return (

    <div className="layout">

      <aside className="sidebar"><div className="logo"><span className="logo-icon">₹</span><span>split<span className="logo-light">wise</span></span></div><div className="side-label">WORKSPACE</div>

        {["Dashboard","Groups","Expenses","Balances"].map((p,i)=><button key={p} className={`nav-item ${page===p?"nav-active":""}`} onClick={()=>setPage(p)}><span>{["⌂","♧","▤","⇄"][i]}</span>{p}</button>)}

        <div className="side-bottom"><div className="avatar">{(user.name||"U").slice(0,1).toUpperCase()}</div><div className="profile"><b>{user.name}</b><span>{user.email}</span></div><button className="logout" title="Logout" onClick={logout}>↗</button></div>

      </aside>

      <main className="main"><header className="topbar"><div><span className="breadcrumb">Workspace / </span><b>{selectedGroup && page==="Group" ? selectedGroup.name : page}</b></div><div className="top-right"><span className="online-dot"></span><span>Local workspace</span><div className="avatar small">{(user.name||"U").slice(0,1).toUpperCase()}</div></div></header>

        <div className="content"><div className="welcome-row"><div><div className="eyebrow purple">YOUR SHARED FINANCES</div><h1>{page==="Dashboard" ? `Good ${new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}, ${user.name.split(" ")[0]} 👋` : page==="Group" && selectedGroup ? selectedGroup.name : page}</h1><p className="muted">{page==="Dashboard"?"Here's a snapshot of your shared spending.":page==="Group"?"Manage members, expenses, and settlements.":`Your ${page.toLowerCase()} at a glance.`}</p></div><button className="primary" onClick={()=>{setModal("group");setPage("Groups");}}>＋ Create group</button></div>

          {notice && <div className="notice" onClick={()=>setNotice("")}>{notice} <span>×</span></div>}

          {page==="Dashboard" && <>

            <section className="metric-grid"><div className="metric"><div className="metric-top"><span>Total group spending</span><span className="metric-icon violet">₹</span></div><h2>{money(totalExpenses)}</h2><small>Across all your groups</small></div><div className="metric"><div className="metric-top"><span>Your groups</span><span className="metric-icon blue">♧</span></div><h2>{groups.length}</h2><small>Shared spaces</small></div><div className="metric"><div className="metric-top"><span>Total expenses</span><span className="metric-icon green">▤</span></div><h2>{groups.reduce((n,g)=>n+g.expenses.length,0)}</h2><small>Recorded transactions</small></div></section>

            <section className="section-card"><div className="section-head"><div><h3>Your groups</h3><p className="muted">Pick up where you left off</p></div><button className="text-button" onClick={()=>setPage("Groups")}>View all →</button></div>{groups.length===0?<div className="empty"><div className="empty-icon">♧</div><h3>No groups yet</h3><p>Create your first group to start sharing expenses.</p><button className="primary" onClick={()=>setModal("group")}>＋ Create your first group</button></div>:<div className="group-grid">{groups.slice(0,4).map(g=><GroupCard key={g.id} group={g} onClick={()=>{setActive(g.id);setPage("Group");}}/>)}</div>}</section>

            <section className="section-card"><div className="section-head"><div><h3>Quick actions</h3><p className="muted">Keep things moving</p></div></div><div className="quick-grid"><button onClick={()=>setModal("group")}><span>＋</span><b>Create a group</b><small>Trips, roommates, friends</small></button><button onClick={()=>{if(groups[0]){setActive(groups[0].id);setPage("Group");setModal("expense")}else setModal("group")}}><span>↗</span><b>Add an expense</b><small>Record a shared bill</small></button><button onClick={()=>setPage("Balances")}><span>⇄</span><b>View balances</b><small>See who owes whom</small></button></div></section>

          </>}

          {page==="Groups" && <section className="section-card"><div className="section-head"><div><h3>All groups</h3><p className="muted">Your shared spaces</p></div><button className="primary" onClick={()=>setModal("group")}>＋ New group</button></div>{groups.length===0?<div className="empty"><h3>Nothing here yet</h3><p>Create a group to begin tracking expenses.</p></div>:<div className="group-grid">{groups.map(g=><GroupCard key={g.id} group={g} onClick={()=>{setActive(g.id);setPage("Group");}}/>)}</div>}</section>}

          {page==="Group" && selectedGroup && <><section className="metric-grid"><div className="metric"><span>Group members</span><h2>{selectedGroup.members.length}</h2></div><div className="metric"><span>Total spending</span><h2>{money(selectedGroup.expenses.reduce((s,e)=>s+e.amount,0))}</h2></div><div className="metric"><span>Expenses</span><h2>{selectedGroup.expenses.length}</h2></div></section><section className="section-card"><div className="section-head"><div><h3>Members</h3><p className="muted">People sharing this group</p></div><button className="primary" onClick={()=>setModal("member")}>＋ Add member</button></div><div className="member-list">{selectedGroup.members.map(m=><div className="member-row" key={m.email+m.name}><div className="avatar">{m.name.slice(0,1).toUpperCase()}</div><div><b>{m.name}</b><small>{m.email||"Group member"}</small></div>{m.name===user.name&&<span className="you-pill">YOU</span>}</div>)}</div></section><section className="section-card"><div className="section-head"><div><h3>Expenses</h3><p className="muted">Every bill, all in one place</p></div><button className="primary" onClick={()=>setModal("expense")}>＋ Add expense</button></div><ExpenseList expenses={selectedGroup.expenses}/></section><section className="section-card"><div className="section-head"><div><h3>Balances</h3><p className="muted">Positive means paid more than your share</p></div><button className="outline" onClick={()=>setModal("settle")}>Record settlement</button></div><div className="balance-list">{balances.map(b=><div className="balance-row" key={b.name}><span>{b.name}</span><b className={b.amount>0.009?"positive":b.amount< -0.009?"negative":""}>{b.amount>0.009?"+":""}{money(b.amount)}</b></div>)}</div></section></>}

          {page==="Expenses" && <section className="section-card"><div className="section-head"><div><h3>Recent expenses</h3><p className="muted">Expenses across all groups</p></div></div><ExpenseList expenses={groups.flatMap(g=>g.expenses.map(e=>({...e,groupName:g.name})))}/></section>}

          {page==="Balances" && <section className="section-card"><div className="section-head"><div><h3>Group balances</h3><p className="muted">Open a group to see member balances and record settlements.</p></div></div>{groups.length===0?<div className="empty"><p>Create a group and add expenses to calculate balances.</p></div>:<div className="group-grid">{groups.map(g=><GroupCard key={g.id} group={g} onClick={()=>{setActive(g.id);setPage("Group");}}/>)}</div>}</section>}

        </div>

      </main>

      {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal("")}}><div className="modal"><div className="modal-head"><div><div className="eyebrow purple">SPLITWISE</div><h2>{modal==="group"?"Create a group":modal==="member"?"Add a member":modal==="expense"?"Add an expense":"Record a settlement"}</h2></div><button className="close" onClick={()=>setModal("")}>×</button></div>

        {modal==="group"&&<form className="stack" onSubmit={createGroup}><label>Group name<input autoFocus required placeholder="e.g. Goa Trip, Flatmates" value={groupName} onChange={e=>setGroupName(e.target.value)}/></label><button className="primary wide">Create group</button></form>}

        {modal==="member"&&<form className="stack" onSubmit={addMember}><label>Member name<input required placeholder="Full name" value={memberName} onChange={e=>setMemberName(e.target.value)}/></label><label>Email (optional)<input type="email" placeholder="friend@example.com" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)}/></label><button className="primary wide">Add member</button></form>}

        {modal==="expense"&&selectedGroup&&<form className="stack" onSubmit={addExpense}><label>Expense description<input required placeholder="Dinner, groceries, cab…" value={expense.title} onChange={e=>setExpense({...expense,title:e.target.value})}/></label><label>Total amount (₹)<input required type="number" min="0.01" step="0.01" placeholder="0.00" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})}/></label><label>Paid by<select required value={expense.paidBy} onChange={e=>setExpense({...expense,paidBy:e.target.value})}><option value="">Select member</option>{selectedGroup.members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Split type<select value={expense.split} onChange={e=>setExpense({...expense,split:e.target.value})}><option value="equal">Split equally</option><option value="custom">Custom amounts</option></select></label>{expense.split==="custom"&&<label>Shares in member order ({selectedGroup.members.map(m=>m.name).join(", ")})<input required placeholder="e.g. 200, 150" value={expense.custom} onChange={e=>setExpense({...expense,custom:e.target.value})}/><small>Enter amounts separated by commas. They must total the expense.</small></label>}<button className="primary wide">Save expense</button></form>}

        {modal==="settle"&&selectedGroup&&<form className="stack" onSubmit={addSettlement}><label>Paid by (debtor)<select required value={settle.from} onChange={e=>setSettle({...settle,from:e.target.value})}><option value="">Select member</option>{selectedGroup.members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Paid to (creditor)<select required value={settle.to} onChange={e=>setSettle({...settle,to:e.target.value})}><option value="">Select member</option>{selectedGroup.members.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><label>Amount (₹)<input required type="number" min="0.01" step="0.01" value={settle.amount} onChange={e=>setSettle({...settle,amount:e.target.value})}/></label><button className="primary wide">Record settlement</button></form>}

      </div></div>}

    </div>

  );

}



function GroupCard({group,onClick}) {

  const total = group.expenses.reduce((s,e)=>s+e.amount,0);

  return <button className="group-card" onClick={onClick}><div className="group-card-top"><span className="group-icon">♧</span><span className="arrow">↗</span></div><h3>{group.name}</h3><p>{group.members.length} member{group.members.length===1?"":"s"} · {group.expenses.length} expense{group.expenses.length===1?"":"s"}</p><div className="group-total"><span>Total spent</span><b>{money(total)}</b></div><div className="mini-avatars">{group.members.slice(0,5).map((m,i)=><span key={m.name+i} title={m.name}>{m.name.slice(0,1).toUpperCase()}</span>)}</div></button>;

}

function ExpenseList({expenses}) {

if(!expenses.length) return <div className="empty compact"><div className="empty-icon">▤</div><h3>No expenses yet</h3><p>Add an expense to see it here.</p></div>;

return <div className="expense-list">{expenses.map(e=><div className="expense-row" key={e.id}><div className="expense-symbol">₹</div><div className="expense-info"><b>{e.title}</b><small>{e.groupName ? e.groupName+" · " : ""}{e.date} · Paid by {e.paidBy}</small></div><b className="expense-amount">{money(e.amount)}</b></div>)}</div>;

}

