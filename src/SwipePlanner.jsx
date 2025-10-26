import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, X, Calendar, ChevronLeft, ChevronRight, Layers, Save, Undo2, LogIn, LogOut, RefreshCw } from "lucide-react";
import { supabase } from "./lib/supabaseClient";

// ----------------- 本地默认数据 -----------------
const STORAGE_KEY = "swipePlanner_v1";
function cryptoRandomId() { return (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)); }
function datePlus(d) { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0,10); }

const defaultProjects = [
  { id: cryptoRandomId(), name: "Xinsheng Choir", color: "#6EE7B7", lanes: {
    today: [{ id: cryptoRandomId(), text: "周四排练曲目单确认", priority: "high", due: datePlus(0) }],
    backlog: [{ id: cryptoRandomId(), text: "设计12月演出海报", priority: "med" }, { id: cryptoRandomId(), text: "Sponsor 套餐文案更新", priority: "low" }],
    done: [] } },
  { id: cryptoRandomId(), name: "XWorld BD", color: "#93C5FD", lanes: {
    today: [{ id: cryptoRandomId(), text: "跟进 Halloween 合作物料", priority: "med", due: datePlus(1) }],
    backlog: [{ id: cryptoRandomId(), text: "整理潜在伙伴 Notion", priority: "low" }],
    done: [] } },
  { id: cryptoRandomId(), name: "Personal Growth", color: "#FBCFE8", lanes: {
    today: [{ id: cryptoRandomId(), text: "10min 快走 + 拉伸", priority: "low" }],
    backlog: [{ id: cryptoRandomId(), text: "录制 WFH Vlog 配音初稿", priority: "med" }],
    done: [] } },
];

function loadLocal() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : { projects: defaultProjects, current: 0 }; }
  catch { return { projects: defaultProjects, current: 0 }; }
}
function saveLocal(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function useLocalState() {
  const [state, setState] = useState(loadLocal);
  useEffect(()=> saveLocal(state), [state]);
  return [state, setState];
}

const laneMeta = { today:{title:"Today", hint:"今日要做"}, backlog:{title:"Backlog", hint:"以后再做"}, done:{title:"Done", hint:"已完成"} };
const PriorityBadge = ({ p }) => <span className={`text-xs px-2 py-0.5 rounded-full ${
  {high:"bg-red-100 text-red-700", med:"bg-yellow-100 text-yellow-700", low:"bg-gray-100 text-gray-700"}[p||"low"]
}`}>{p||"low"}</span>;

// ----------------- 把行记录 <-> 组件状态 相互转换 -----------------
function rowsToState(rows) {
  if (!rows || rows.length === 0) return { projects: defaultProjects, current: 0 };
  const map = new Map();
  for (const r of rows) {
    const key = r.project || "General";
    if (!map.has(key)) map.set(key, { id: cryptoRandomId(), name: key, color: "#A7F3D0", lanes: { today:[], backlog:[], done:[] } });
    const p = map.get(key);
    const t = { id: r.id, text: r.text, priority: r.priority || "low", due: r.due || null };
    (p.lanes[r.lane || "backlog"] || p.lanes.backlog).push(t);
  }
  return { projects: Array.from(map.values()), current: 0 };
}

function stateTaskToRow(projectName, lane, task, userId) {
  return {
    id: task.id,
    user_id: userId,
    project: projectName,
    lane,
    text: task.text,
    priority: task.priority || "low",
    due: task.due || null,
    updated_at: new Date().toISOString(),
  };
}

// ----------------- 组件 -----------------
export default function SwipePlanner() {
  const [state, setState] = useLocalState();
  const { projects, current } = state;
  const [editing, setEditing] = useState(null); // { projectId, lane, task }
  const project = projects[current];

  // -------- 登录状态 --------
  const [session, setSession] = useState(null);
  const userId = session?.user?.id || null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  // ----------- 安全同步：若云端为空，则把本地任务上传；否则用云端覆盖本地 ----------
  async function loadFromCloud() {
    if (!userId) {
      console.warn("未登录，跳过上云同步。");
      return;
    }

    const { data: cloudData, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      alert("读取云端失败：" + error.message);
      return;
    }

    const localData = loadLocal();
    const cloud = cloudData || [];

    if (cloud.length === 0) {
      // ✅ 云端是空的（第一次登录/初始化）→ 把本地所有任务迁移到云端
      const rows = [];
      for (const p of localData.projects || []) {
        for (const lane of ["today", "backlog", "done"]) {
          for (const t of (p.lanes?.[lane] || [])) {
            rows.push(stateTaskToRow(p.name, lane, t, userId));
          }
        }
      }
      if (rows.length > 0) {
        const { error: upErr } = await supabase.from("tasks").upsert(rows, { onConflict: "id" });
        if (upErr) { alert("首次上云失败：" + upErr.message); return; }
      }
      // 保留本地当前视图
      setState(localData);
    } else {
      // ✅ 云端已有数据 → 用云端覆盖本地，并更新本地缓存
      const next = rowsToState(cloud);
      setState(next);
      saveLocal(next);
    }
  }

  // 页面加载或 userId 变化时自动执行一次
  useEffect(() => {
    loadFromCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 可选：订阅实时（需要你在 Supabase 表设置里勾选 Enable Realtime）
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("realtime:tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        () => loadFromCloud()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // -------- 项目切换、拖拽等本地交互 --------
  const go = (dir) => setState(s => ({ ...s, current: (s.current + dir + s.projects.length) % s.projects.length }));

  const dropTask = async (taskId, laneKey, opts) => {
    // 先本地更新
    setState((s) => {
      const list = s.projects[current];
      const lanes = { ...list.lanes };
      let foundLane=null, foundTask=null;
      for (const k of Object.keys(lanes)) {
        const idx = lanes[k].findIndex(t=>t.id===taskId);
        if (idx !== -1) { foundLane=k; foundTask=lanes[k][idx]; if (opts?.del) lanes[k].splice(idx,1); break; }
      }
      if (opts?.edit && foundTask) { setEditing({ projectId: list.id, lane: foundLane, task: foundTask }); return s; }
      if (!opts?.del && foundTask && laneKey !== foundLane) {
        lanes[foundLane] = lanes[foundLane].filter(t=>t.id!==taskId);
        lanes[laneKey] = [...lanes[laneKey], foundTask];
      }
      const newProjects = s.projects.map((p,i)=> i===current ? { ...p, lanes } : p);
      return { ...s, projects:newProjects };
    });

    // 再同步云端
    if (!userId) { alert("请先登录同步，否则下次同步会还原。"); return; }
    if (opts?.del) {
      await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", userId);
    } else {
      await supabase.from("tasks").update({ lane: laneKey, updated_at: new Date().toISOString() })
        .eq("id", taskId).eq("user_id", userId);
    }
  };

  const addTask = (lane="today") => setEditing({ projectId: project.id, lane, task:null });

  const saveEdit = async (payload) => {
    // 先本地更新
    setState((s) => {
      const pIdx = s.projects.findIndex(p=>p.id===editing.projectId);
      if (pIdx===-1) return s;
      const proj = s.projects[pIdx];
      const lanes = { ...proj.lanes };
      if (editing.task) {
        lanes[editing.lane] = lanes[editing.lane].map(t=> t.id===editing.task.id ? { ...t, ...payload } : t);
      } else {
        lanes[editing.lane] = [...lanes[editing.lane], { id: cryptoRandomId(), ...payload }];
      }
      const newProjects = s.projects.map((p,i)=> i===pIdx ? { ...p, lanes } : p);
      return { ...s, projects:newProjects };
    });

    // 再写云端
    if (!userId) {
      alert("请先点击右上角“登录同步”，否则刷新/同步会还原。");
    } else {
      const isEdit = !!editing.task;
      const t = isEdit ? { ...editing.task, ...payload } : { id: cryptoRandomId(), ...payload };
      const row = stateTaskToRow(project.name, editing.lane, t, userId);
      await supabase.from("tasks").upsert(row, { onConflict: "id" });
    }
    setEditing(null);
  };

  const addProject = () => {
    const name = prompt("项目名称：", "New Project"); if (!name) return;
    const color = prompt("项目颜色（十六进制或颜色名）：", "#A7F3D0") || "#A7F3D0";
    setState(s=>({ ...s, projects:[...s.projects, { id: cryptoRandomId(), name, color, lanes:{ today:[], backlog:[], done:[] } }], current:s.projects.length }));
  };
  const renameProject = () => {
    const name = prompt("重命名项目：", project.name) || project.name;
    const color = prompt("项目颜色：", project.color) || project.color;
    setState(s=>({ ...s, projects: s.projects.map((p,i)=> i===current ? { ...p, name, color } : p) }));
  };
  const deleteProject = async () => {
    if(!confirm(`删除项目 “${project.name}”？`)) return;
    // 本地删
    setState(s=>{
      const newArr = s.projects.filter((_,i)=> i!==current);
      return { projects: newArr.length ? newArr : defaultProjects, current: 0 };
    });
    // 云端删
    if (userId) await supabase.from("tasks").delete().eq("user_id", userId).eq("project", project.name);
  };

  // -------- 登录 / 登出 --------
  const [email, setEmail] = useState("");
  const signInWithEmail = async () => {
    if (!email) return alert("请输入邮箱");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if (error) alert(error.message); else alert("登录邮件已发送，请到邮箱点开链接返回此页。");
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  // -------- UI 组件 --------
  function TaskCard({ task, onEdit, onDelete }) {
    return (
      <div className="group border rounded-xl px-3 py-2 bg-white shadow-sm hover:shadow transition flex items-start gap-2"
           draggable onDragStart={e=>e.dataTransfer.setData("text/task-id", task.id)}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{task.text}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            {task.priority && <PriorityBadge p={task.priority} />}
            {task.due && <span className="inline-flex items-center gap-1"><Calendar size={14}/>{task.due}</span>}
          </div>
        </div>
        <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100" onClick={onEdit} title="编辑"><Pencil size={16}/></button>
        <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100" onClick={onDelete} title="删除"><Trash2 size={16}/></button>
      </div>
    );
  }
  function Lane({ laneKey, items, onDropTask }) {
    return (
      <div className="flex-1 min-h-[160px] rounded-2xl border bg-gray-50 p-3"
        onDragOver={e=>e.preventDefault()}
        onDrop={e=>{ const id=e.dataTransfer.getData("text/task-id"); if(id) onDropTask(id, laneKey); }}>
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-sm">{laneMeta[laneKey].title}</div>
          <div className="text-xs text-gray-500">{laneMeta[laneKey].hint}</div>
        </div>
        <div className="space-y-2">
          {items.map((t)=>(
            <TaskCard key={t.id} task={t}
              onEdit={()=>onDropTask(t.id, laneKey, { edit:true })}
              onDelete={()=>onDropTask(t.id, laneKey, { del:true })}/>
          ))}
          {items.length===0 && <div className="text-xs text-gray-400 italic">拖拽任务到这里</div>}
        </div>
      </div>
    );
  }
  function ProjectHeader({ index, total, name, color, onPrev, onNext }) {
    return (
      <div className="flex items-center justify-between mb-4">
        <button className="p-2 rounded-xl hover:bg-gray-100" onClick={onPrev} title="上一项目"><ChevronLeft/></button>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white shadow-sm">
            <Layers size={16}/><span className="font-semibold">{name}</span>
            <span className="text-xs text-gray-500">{index+1}/{total}</span>
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          </div>
        </div>
        <button className="p-2 rounded-xl hover:bg-gray-100" onClick={onNext} title="下一项目"><ChevronRight/></button>
      </div>
    );
  }
  function EditModal({ open, initial, onClose, onSave, title }) {
    const [text, setText] = useState(initial?.text || "");
    const [priority, setPriority] = useState(initial?.priority || "med");
    const [due, setDue] = useState(initial?.due || "");
    useEffect(()=>{ setText(initial?.text||""); setPriority(initial?.priority||"med"); setDue(initial?.due||""); }, [initial, open]);
    if(!open) return null;
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e)=>e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{title}</h3>
            <button className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose}><X size={18}/></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600">任务内容</label>
              <input className="mt-1 w-full rounded-xl border px-3 py-2" value={text} onChange={e=>setText(e.target.value)} placeholder="例如：跟进合作、写方案…"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">优先级</label>
                <select className="mt-1 w-full rounded-xl border px-3 py-2" value={priority} onChange={e=>setPriority(e.target.value)}>
                  <option value="high">high</option><option value="med">med</option><option value="low">low</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">截止日期</label>
                <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2" value={due} onChange={e=>setDue(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={onClose}><Undo2 size={16}/>取消</button>
              <button className="inline-flex items-center gap-1 rounded-xl bg-black text-white px-3 py-2 hover:opacity-90" onClick={()=>onSave({ text, priority, due })}><Save size={16}/>保存</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------- 渲染 --------
  return (
    <div className="min-h-[80vh] w-full grid place-items-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-5xl">
        {/* 顶部：标题 + 登录条 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">SwipePlanner</h1>
            <span className="text-gray-500">— 左右滑动切换项目，三栏管理任务</span>
          </div>
          <div className="flex items-center gap-2">
            {!userId ? (
              <div className="flex items-center gap-2">
                <input className="rounded-xl border px-3 py-2" placeholder="输入邮箱获取登录链接"
                       value={email} onChange={e=>setEmail(e.target.value)} />
                <button className="inline-flex items-center gap-1 rounded-xl bg-black text-white px-3 py-2 hover:opacity-90"
                        onClick={signInWithEmail}><LogIn size={16}/>登录同步</button>
              </div>
            ) : (
              <>
                <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white"
                        onClick={loadFromCloud}><RefreshCw size={16}/>手动同步</button>
                <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white"
                        onClick={signOut}><LogOut size={16}/>退出</button>
              </>
            )}
          </div>
        </div>

        <ProjectHeader index={current} total={projects.length} name={project.name} color={project.color}
          onPrev={()=>go(-1)} onNext={()=>go(1)} />

        <motion.div drag="x" dragConstraints={{ left:0, right:0 }} whileTap={{ cursor:"grabbing" }}
          className="rounded-3xl border bg-white shadow-lg p-4 md:p-6" style={{ borderColor: project.color }}>
          {/* 快速新增 */}
          <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <QuickAdd onAdd={(lane)=> setEditing({ projectId: project.id, lane, task:null })} />
            <div className="text-xs text-gray-500 md:ml-auto">提示：拖拽任务在三栏之间移动，← → 切换项目</div>
          </div>

          {/* 三栏 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <Lane laneKey="today"   items={project.lanes.today}   onDropTask={dropTask} />
            <Lane laneKey="backlog" items={project.lanes.backlog} onDropTask={dropTask} />
            <Lane laneKey="done"    items={project.lanes.done}    onDropTask={dropTask} />
          </div>
        </motion.div>

        {/* 项目管理按钮 */}
        <div className="mt-4 flex items-center gap-2">
          <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white" onClick={addProject}><Plus size={16}/>新项目</button>
          <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white" onClick={renameProject}><Pencil size={16}/>重命名</button>
          <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white" onClick={deleteProject}><Trash2 size={16}/>删除项目</button>
        </div>
      </div>

      <EditModal open={!!editing} initial={editing?.task || null}
        title={editing?.task ? "编辑任务" : "新增任务"}
        onClose={()=>setEditing(null)} onSave={saveEdit} />
    </div>
  );
}

function QuickAdd({ onAdd }) {
  const [lane, setLane] = useState("today");
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 bg-gray-50">
      <span className="text-sm">快速新增到</span>
      <select className="rounded-xl border px-2 py-1 bg-white" value={lane} onChange={e=>setLane(e.target.value)}>
        <option value="today">Today</option><option value="backlog">Backlog</option><option value="done">Done</option>
      </select>
      <button className="inline-flex items-center gap-1 rounded-xl bg-black text-white px-3 py-2 hover:opacity-90" onClick={()=>onAdd(lane)}>
        <Plus size={16}/>新增任务
      </button>
    </div>
  );
}
