
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Pencil, Check, X, Calendar, ChevronLeft, ChevronRight, Layers, Save, Undo2 } from "lucide-react";

/**
 * SwipePlanner — A Tinder-style project switcher + per-project task board
 * - Swipe (drag) left/right to change project
 * - Add/edit/delete tasks inside each project
 * - Three lanes: Today / Backlog / Done (drag & drop)
 * - Keyboard: ← → to switch project, Enter to add task
 * - Persists to localStorage
 * - Fully client-side single-file React component
 */

const STORAGE_KEY = "swipePlanner_v1";

const defaultProjects = [
  {
    id: cryptoRandomId(),
    name: "Xinsheng Choir",
    color: "#6EE7B7",
    lanes: {
      today: [
        { id: cryptoRandomId(), text: "周四排练曲目单确认", priority: "high", due: datePlus(0) },
      ],
      backlog: [
        { id: cryptoRandomId(), text: "设计12月演出海报", priority: "med" },
        { id: cryptoRandomId(), text: "Sponsor 套餐文案更新", priority: "low" },
      ],
      done: [],
    },
  },
  {
    id: cryptoRandomId(),
    name: "XWorld BD",
    color: "#93C5FD",
    lanes: {
      today: [
        { id: cryptoRandomId(), text: "跟进 Halloween 合作物料", priority: "med", due: datePlus(1) },
      ],
      backlog: [
        { id: cryptoRandomId(), text: "整理潜在伙伴 Notion", priority: "low" },
      ],
      done: [],
    },
  },
  {
    id: cryptoRandomId(),
    name: "Personal Growth",
    color: "#FBCFE8",
    lanes: {
      today: [
        { id: cryptoRandomId(), text: "10min 快走 + 拉伸", priority: "low" },
      ],
      backlog: [
        { id: cryptoRandomId(), text: "录制 WFH Vlog 配音初稿", priority: "med" },
      ],
      done: [],
    },
  },
];

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function datePlus(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { projects: defaultProjects, current: 0 };
    return JSON.parse(raw);
  } catch (e) {
    return { projects: defaultProjects, current: 0 };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function useLocalState() {
  const [state, setState] = useState(loadState);
  useEffect(() => saveState(state), [state]);
  return [state, setState];
}

const laneMeta = {
  today: { title: "Today", hint: "今日要做" },
  backlog: { title: "Backlog", hint: "以后再做" },
  done: { title: "Done", hint: "已完成" },
};

function PriorityBadge({ p }) {
  const map = {
    high: "bg-red-100 text-red-700",
    med: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[p] || map.low}`}>{p || "low"}</span>
  );
}

function useKeyNav(onLeft, onRight) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.target instanceof HTMLInputElement) || (e.target instanceof HTMLTextAreaElement) || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowLeft") onLeft();
      if (e.key === "ArrowRight") onRight();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeft, onRight]);
}

function TaskCard({ task, onEdit, onDelete }) {
  return (
    <div
      className="group border rounded-xl px-3 py-2 bg-white shadow-sm hover:shadow transition flex items-start gap-2"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{task.text}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          {task.priority && <PriorityBadge p={task.priority} />}
          {task.due && (
            <span className="inline-flex items-center gap-1"><Calendar size={14} />{task.due}</span>
          )}
        </div>
      </div>
      <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100" onClick={onEdit} title="编辑"><Pencil size={16} /></button>
      <button className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100" onClick={onDelete} title="删除"><Trash2 size={16} /></button>
    </div>
  );
}

function Lane({ laneKey, items, onDropTask }) {
  return (
    <div
      className="flex-1 min-h-[160px] rounded-2xl border bg-gray-50 p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/task-id");
        if (id) onDropTask(id, laneKey);
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">{laneMeta[laneKey].title}</div>
        <div className="text-xs text-gray-500">{laneMeta[laneKey].hint}</div>
      </div>
      <div className="space-y-2">
        {items.map((t) => (
          <TaskCard key={t.id} task={t} onEdit={() => onDropTask(t.id, laneKey, { edit: true })} onDelete={() => onDropTask(t.id, laneKey, { del: true })} />
        ))}
        {items.length === 0 && (
          <div className="text-xs text-gray-400 italic">拖拽任务到这里</div>
        )}
      </div>
    </div>
  );
}

function ProjectHeader({ index, total, name, color, onPrev, onNext }) {
  return (
     <div className="flex items-center justify-between mb-4">
        <button className="p-2 rounded-xl hover:bg-gray-100" onClick={onPrev} title="上一项目"><ChevronLeft /></button>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white shadow-sm">
            <Layers size={16} />
            <span className="font-semibold">{name}</span>
            <span className="text-xs text-gray-500">{index + 1}/{total}</span>
            <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          </div>
        </div>
        <button className="p-2 rounded-xl hover:bg-gray-100" onClick={onNext} title="下一项目"><ChevronRight /></button>
     </div>
  );
}

function EditModal({ open, initial, onClose, onSave, title }) {
  const [text, setText] = useState(initial?.text || "");
  const [priority, setPriority] = useState(initial?.priority || "med");
  const [due, setDue] = useState(initial?.due || "");
  useEffect(() => {
    setText(initial?.text || "");
    setPriority(initial?.priority || "med");
    setDue(initial?.due || "");
  }, [initial, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <button className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">任务内容</label>
            <input className="mt-1 w-full rounded-xl border px-3 py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：跟进合作、写方案…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600">优先级</label>
              <select className="mt-1 w-full rounded-xl border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="high">high</option>
                <option value="med">med</option>
                <option value="low">low</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">截止日期</label>
              <input type="date" className="mt-1 w-full rounded-xl border px-3 py-2" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={onClose}><Undo2 size={16}/>取消</button>
            <button className="inline-flex items-center gap-1 rounded-xl bg-black text-white px-3 py-2 hover:opacity-90" onClick={() => onSave({ text, priority, due })}><Save size={16}/>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SwipePlanner() {
  const [state, setState] = useLocalState();
  const { projects, current } = state;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // { projectId, lane, task }

  const project = projects[current];

  const go = (dir) => {
    setState((s) => ({ ...s, current: (s.current + dir + s.projects.length) % s.projects.length }));
  };

  useKeyNav(() => go(-1), () => go(1));

  const cardRef = useRef(null);

  // drag end decides swipe threshold
  const onDragEnd = (_e, info) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    const threshold = 120;
    if (offset < -threshold || velocity < -800) go(1);
    else if (offset > threshold || velocity > 800) go(-1);
  };

  const dropTask = (taskId, laneKey, opts) => {
    setState((s) => {
      const list = s.projects[current];
      const lanes = { ...list.lanes };

      // find existing lane
      let foundLane = null; let foundIdx = -1; let foundTask = null;
      for (const k of Object.keys(lanes)) {
        const idx = lanes[k].findIndex((t) => t.id === taskId);
        if (idx !== -1) { foundLane = k; foundIdx = idx; foundTask = lanes[k][idx]; break; }
      }

      if (!foundTask && !opts?.edit && !opts?.del) return s; // might be creating new

      if (opts?.del && foundTask) {
        lanes[foundLane] = lanes[foundLane].filter((t) => t.id !== taskId);
      } else if (opts?.edit && foundTask) {
        // open modal to edit
        setEditing({ projectId: list.id, lane: foundLane, task: foundTask });
        return s;
      } else if (foundTask && laneKey !== foundLane) {
        lanes[foundLane] = lanes[foundLane].filter((t) => t.id !== taskId);
        lanes[laneKey] = [...lanes[laneKey], foundTask];
      }

      const newProjects = s.projects.map((p, i) => (i === current ? { ...p, lanes } : p));
      return { ...s, projects: newProjects };
    });
  };

  const addTask = (lane = "today") => {
    setEditing({ projectId: project.id, lane, task: null });
  };

  const saveEdit = (payload) => {
    setState((s) => {
      const pIdx = s.projects.findIndex((p) => p.id === editing.projectId);
      if (pIdx === -1) return s;
      const proj = s.projects[pIdx];
      const lanes = { ...proj.lanes };
      if (editing.task) {
        lanes[editing.lane] = lanes[editing.lane].map((t) => (t.id === editing.task.id ? { ...t, ...payload } : t));
      } else {
        lanes[editing.lane] = [
          ...lanes[editing.lane],
          { id: cryptoRandomId(), ...payload },
        ];
      }
      const newProjects = s.projects.map((p, i) => (i === pIdx ? { ...p, lanes } : p));
      return { ...s, projects: newProjects };
    });
    setEditing(null);
  };

  const addProject = () => {
    const name = prompt("项目名称：", "New Project");
    if (!name) return;
    const color = prompt("项目颜色（十六进制或颜色名）：", "#A7F3D0") || "#A7F3D0";
    setState((s) => ({
      ...s,
      projects: [
        ...s.projects,
        { id: cryptoRandomId(), name, color, lanes: { today: [], backlog: [], done: [] } },
      ],
      current: s.projects.length,
    }));
  };

  const renameProject = () => {
    const name = prompt("重命名项目：", project.name) || project.name;
    const color = prompt("项目颜色：", project.color) || project.color;
    setState((s) => ({
      ...s,
      projects: s.projects.map((p, i) => (i === current ? { ...p, name, color } : p)),
    }));
  };

  const deleteProject = () => {
    if (!confirm(`删除项目 “${project.name}”？`)) return;
    setState((s) => {
      const newArr = s.projects.filter((_, i) => i !== current);
      return { projects: newArr.length ? newArr : defaultProjects, current: 0 };
    });
  };

  return (
    <div className="min-h-[80vh] w-full grid place-items-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">SwipePlanner</h1>
            <span className="text-gray-500">— 左右滑动切换项目，三栏管理任务</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white" onClick={addProject}><Plus size={16}/>新项目</button>
            <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white" onClick={renameProject}><Pencil size={16}/>重命名</button>
            <button className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-white" onClick={deleteProject}><Trash2 size={16}/>删除项目</button>
          </div>
        </div>

        <ProjectHeader index={current} total={projects.length} name={project.name} color={project.color} onPrev={() => go(-1)} onNext={() => go(1)} />

        <motion.div
          ref={cardRef}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          whileTap={{ cursor: "grabbing" }}
          onDragEnd={onDragEnd}
          className="rounded-3xl border bg-white shadow-lg p-4 md:p-6"
          style={{ borderColor: project.color }}
        >
          {/* Quick add */}
          <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <QuickAdd onAdd={(lane) => addTask(lane)} />
            <div className="text-xs text-gray-500 md:ml-auto">提示：拖拽任务在三栏之间移动，← → 切换项目</div>
          </div>

          {/* Lanes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <Lane laneKey="today" items={project.lanes.today} onDropTask={dropTask} />
            <Lane laneKey="backlog" items={project.lanes.backlog} onDropTask={dropTask} />
            <Lane laneKey="done" items={project.lanes.done} onDropTask={dropTask} />
          </div>
        </motion.div>
      </div>

      <EditModal
        open={!!editing}
        initial={editing?.task || null}
        title={editing?.task ? "编辑任务" : "新增任务"}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />
    </div>
  );
}

function QuickAdd({ onAdd }) {
  const [lane, setLane] = useState("today");
  return (
    <div className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 bg-gray-50">
      <span className="text-sm">快速新增到</span>
      <select className="rounded-xl border px-2 py-1 bg-white" value={lane} onChange={(e) => setLane(e.target.value)}>
        <option value="today">Today</option>
        <option value="backlog">Backlog</option>
        <option value="done">Done</option>
      </select>
      <button className="inline-flex items-center gap-1 rounded-xl bg-black text-white px-3 py-2 hover:opacity-90" onClick={() => onAdd(lane)}>
        <Plus size={16}/>新增任务
      </button>
    </div>
  );
}
