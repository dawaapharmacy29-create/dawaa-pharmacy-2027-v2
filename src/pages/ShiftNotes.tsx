import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/lib/supabase";
import { cleanEgyptianPhone, generateWhatsAppLink } from "@/lib/whatsapp";
import { selectableStaffChoices } from "@/lib/staffFallback";
import type { Staff } from "@/types/database";

type NoteStatus = "new" | "in_progress" | "completed" | "cancelled" | "overdue";
type NotePriority = "normal" | "important" | "urgent" | "critical";

interface ShiftNote {
  id: string;
  title: string;
  details: string | null;
  note_type: string | null;
  branch: string | null;
  customer_id?: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  invoice_no: string | null;
  author_id: string | null;
  author_name: string | null;
  due_at: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  priority: NotePriority | null;
  status: NoteStatus | null;
  is_recurring: boolean | null;
  repeat_days: number | null;
  recurrence_times: string[] | null;
  handed_over: boolean | null;
  handed_over_at: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
  closure_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ShiftNoteLog {
  id: string;
  note_id: string;
  action: string;
  actor_name: string | null;
  details: string | null;
  created_at: string | null;
}

interface ShiftNoteOccurrence {
  id: string;
  note_id: string;
  occurrence_at: string | null;
  status: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
}

const typeLabels: Record<string, string> = {
  customer: "عميل",
  collection: "تحصيل",
  nursing: "تمريض",
  delivery: "دليفري",
  follow_up: "متابعة",
  missing_item: "صنف ناقص",
  problem: "مشكلة",
  general: "عام",
};

const priorityLabels: Record<NotePriority, string> = {
  normal: "عادي",
  important: "مهم",
  urgent: "عاجل",
  critical: "حرج",
};

const statusLabels: Record<NoteStatus, string> = {
  new: "جديدة",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغية",
  overdue: "متأخرة",
};

const emptyForm = {
  title: "",
  details: "",
  note_type: "general",
  branch: "فرع شكري",
  customer_name: "",
  customer_phone: "",
  invoice_no: "",
  due_at: "",
  assigned_to_name: "",
  priority: "normal" as NotePriority,
  is_recurring: false,
  repeat_days: 1,
  recurrence_times: "09:00,21:00",
};

function todayInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function isOverdue(note: ShiftNote) {
  if (!note.due_at || ["completed", "cancelled"].includes(note.status || "")) return false;
  return new Date(note.due_at).getTime() < Date.now();
}

function dateLabel(value?: string | null) {
  if (!value) return "غير محدد";
  return new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

function statusClass(note: ShiftNote) {
  if (isOverdue(note)) return "bg-red-950/60 border-red-500/35 text-red-100";
  if (note.status === "completed") return "bg-emerald-500/10 border-emerald-400/25 text-emerald-200";
  if (note.status === "cancelled") return "bg-slate-500/10 border-slate-400/25 text-slate-300";
  if (note.priority === "critical" || note.priority === "urgent") return "bg-red-500/10 border-red-400/25 text-red-100";
  if (note.priority === "important") return "bg-amber-500/10 border-amber-400/25 text-amber-100";
  return "bg-blue-500/10 border-blue-400/25 text-blue-100";
}

export default function ShiftNotes() {
  const { user, isAdmin } = useAuth();
  const { data: staffRows } = useSupabaseQuery<Staff>({ table: "staff", realtimeEnabled: false });
  const staffChoices = useMemo(() => selectableStaffChoices(staffRows as unknown as Record<string, unknown>[]), [staffRows]);
  const [notes, setNotes] = useState<ShiftNote[]>([]);
  const [logs, setLogs] = useState<ShiftNoteLog[]>([]);
  const [occurrences, setOccurrences] = useState<ShiftNoteOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ShiftNote | null>(null);
  const [editing, setEditing] = useState<ShiftNote | null>(null);
  const [comment, setComment] = useState("");
  const [filter, setFilter] = useState("today");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ ...emptyForm, due_at: todayInput() });

  const canManage = isAdmin || /مدير|admin/i.test(user?.role || "");

  const loadNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shift_notes")
      .select("*")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500);
    if (error) {
      toast.error("تعذر تحميل ملاحظات الشيفتات. تأكد من تشغيل ترقية قاعدة البيانات.");
      setLoading(false);
      return;
    }
    setNotes((data || []) as ShiftNote[]);
    setLoading(false);
  };

  const loadDetails = async (note: ShiftNote) => {
    setSelected(note);
    const [{ data: logRows }, { data: occurrenceRows }] = await Promise.all([
      supabase.from("shift_note_logs").select("*").eq("note_id", note.id).order("created_at", { ascending: false }),
      supabase.from("shift_note_occurrences").select("*").eq("note_id", note.id).order("occurrence_at", { ascending: true }),
    ]);
    setLogs((logRows || []) as ShiftNoteLog[]);
    setOccurrences((occurrenceRows || []) as ShiftNoteOccurrence[]);
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const addLog = async (noteId: string, action: string, details?: string) => {
    await supabase.from("shift_note_logs").insert({
      note_id: noteId,
      action,
      actor_id: user?.id || null,
      actor_name: user?.name || "النظام",
      details: details || null,
    });
  };

  const createOccurrences = async (noteId: string) => {
    if (!form.is_recurring) return;
    const days = Math.max(1, Number(form.repeat_days || 1));
    const times = form.recurrence_times.split(",").map((time) => time.trim()).filter(Boolean);
    if (times.length === 0) return;
    const rows = [];
    const base = new Date(form.due_at || new Date());
    for (let day = 0; day < days; day += 1) {
      for (const time of times) {
        const [hour, minute] = time.split(":").map(Number);
        const occurrence = new Date(base);
        occurrence.setDate(base.getDate() + day);
        occurrence.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
        rows.push({ note_id: noteId, occurrence_at: occurrence.toISOString(), status: "pending" });
      }
    }
    if (rows.length) await supabase.from("shift_note_occurrences").insert(rows);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ ...emptyForm, due_at: todayInput() });
  };

  const saveNote = async () => {
    if (!form.title.trim()) {
      toast.error("اكتب عنوان الملحوظة");
      return;
    }
    setSaving(true);
    const selectedStaff = staffChoices.find((item) => item.name === form.assigned_to_name);
    const payload = {
      title: form.title.trim(),
      details: form.details.trim() || null,
      note_type: form.note_type,
      branch: form.branch,
      customer_name: form.customer_name.trim() || null,
      customer_phone: form.customer_phone.trim() || null,
      invoice_no: form.invoice_no.trim() || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      assigned_to_id: selectedStaff?.id || null,
      assigned_to_name: form.assigned_to_name || null,
      priority: form.priority,
      is_recurring: form.is_recurring,
      repeat_days: form.is_recurring ? Number(form.repeat_days || 1) : null,
      recurrence_times: form.is_recurring ? form.recurrence_times.split(",").map((item) => item.trim()).filter(Boolean) : null,
      author_id: editing?.author_id || user?.id || null,
      author_name: editing?.author_name || user?.name || null,
      status: editing?.status || "new",
      updated_at: new Date().toISOString(),
    };
    const request = editing
      ? supabase.from("shift_notes").update(payload).eq("id", editing.id).select("*").single()
      : supabase.from("shift_notes").insert(payload).select("*").single();
    const { data, error } = await request;
    if (error) {
      toast.error(`تعذر حفظ الملحوظة: ${error.message}`);
      setSaving(false);
      return;
    }
    await addLog(data.id, editing ? "update" : "create", editing ? "تعديل بيانات الملحوظة" : "إنشاء ملحوظة جديدة");
    if (!editing) await createOccurrences(data.id);
    toast.success(editing ? "تم تعديل الملحوظة" : "تم إنشاء ملحوظة الشيفت");
    resetForm();
    await loadNotes();
    setSaving(false);
  };

  const updateStatus = async (note: ShiftNote, status: NoteStatus, reason?: string) => {
    const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (["completed", "cancelled"].includes(status)) {
      payload.closed_at = new Date().toISOString();
      payload.closed_by_id = user?.id || null;
      payload.closed_by_name = user?.name || null;
      payload.closure_reason = reason || null;
    }
    const { data, error } = await supabase.from("shift_notes").update(payload).eq("id", note.id).select("*").single();
    if (error) {
      toast.error(`تعذر تحديث حالة الملحوظة: ${error.message}`);
      return;
    }
    await addLog(note.id, status, reason || statusLabels[status]);
    toast.success(status === "completed" ? "تم تنفيذ الملحوظة" : "تم تحديث الملحوظة");
    await loadNotes();
    if (selected?.id === note.id) await loadDetails(data as ShiftNote);
  };

  const addComment = async () => {
    if (!selected || !comment.trim()) return;
    await addLog(selected.id, "comment", comment.trim());
    setComment("");
    await loadDetails(selected);
  };

  const handoverOpenNotes = async () => {
    const openIds = notes.filter((note) => !["completed", "cancelled"].includes(note.status || "")).map((note) => note.id);
    if (openIds.length === 0) {
      toast.info("لا توجد ملاحظات مفتوحة للتسليم");
      return;
    }
    const { error } = await supabase
      .from("shift_notes")
      .update({ handed_over: true, handed_over_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("id", openIds);
    if (error) {
      toast.error(`تعذر تسليم الشيفت: ${error.message}`);
      return;
    }
    await Promise.all(openIds.map((id) => addLog(id, "handover", "تم تسليم الملحوظة للشيفت التالي")));
    toast.success(`تم تسليم ${openIds.length} ملاحظة للشيفت التالي`);
    await loadNotes();
  };

  const startEdit = (note: ShiftNote) => {
    setEditing(note);
    setForm({
      title: note.title || "",
      details: note.details || "",
      note_type: note.note_type || "general",
      branch: note.branch || "فرع شكري",
      customer_name: note.customer_name || "",
      customer_phone: note.customer_phone || "",
      invoice_no: note.invoice_no || "",
      due_at: note.due_at ? new Date(note.due_at).toISOString().slice(0, 16) : todayInput(),
      assigned_to_name: note.assigned_to_name || "",
      priority: note.priority || "normal",
      is_recurring: Boolean(note.is_recurring),
      repeat_days: note.repeat_days || 1,
      recurrence_times: (note.recurrence_times || ["09:00", "21:00"]).join(","),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return notes.filter((note) => {
      const due = note.due_at ? new Date(note.due_at) : null;
      const matchesFilter =
        filter === "all" ||
        (filter === "mine" && [note.assigned_to_name, note.author_name].includes(user?.name || "")) ||
        (filter === "today" && due && due.toDateString() === now.toDateString()) ||
        (filter === "tomorrow" && due && due.toDateString() === tomorrow.toDateString()) ||
        (filter === "overdue" && isOverdue(note)) ||
        (filter === "urgent" && ["urgent", "critical"].includes(note.priority || "")) ||
        filter === note.status ||
        filter === note.branch ||
        filter === note.note_type ||
        filter === note.assigned_to_name;
      const haystack = [note.title, note.details, note.customer_name, note.customer_phone, note.invoice_no, note.branch, note.assigned_to_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
  }, [filter, notes, search, user?.name]);

  const summary = useMemo(() => {
    const today = new Date().toDateString();
    return {
      today: notes.filter((note) => note.due_at && new Date(note.due_at).toDateString() === today).length,
      overdue: notes.filter(isOverdue).length,
      urgent: notes.filter((note) => ["urgent", "critical"].includes(note.priority || "")).length,
      completed: notes.filter((note) => note.status === "completed" && note.closed_at && new Date(note.closed_at).toDateString() === today).length,
    };
  }, [notes]);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <div className="page-title flex items-center gap-3">
            <MessageSquare className="text-teal-300" /> ملاحظات الشيفتات
          </div>
          <p className="text-slate-400 text-sm mt-2">متابعة أي ملحوظة بين الشيفتات تخص عميل أو تحصيل أو دليفري أو تمريض أو مهمة في وقت محدد.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handoverOpenNotes} className="btn-primary flex items-center gap-2"><Send size={16} /> تسليم للشيفت التالي</button>
          <button onClick={loadNotes} className="btn-secondary flex items-center gap-2"><RefreshCw size={16} /> تحديث</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat label="ملاحظات اليوم" value={summary.today} />
        <MiniStat label="متأخرة" value={summary.overdue} danger />
        <MiniStat label="عاجلة/حرجة" value={summary.urgent} danger />
        <MiniStat label="مكتملة اليوم" value={summary.completed} success />
      </div>

      <div className="bg-[#1B2B4B] border border-[#2d4063] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="section-title">{editing ? "تعديل ملحوظة" : "إضافة ملحوظة جديدة"}</div>
          {editing && <button onClick={resetForm} className="btn-secondary text-sm">إلغاء التعديل</button>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <input className="input-dark lg:col-span-2" placeholder="عنوان مختصر للملحوظة" value={form.title} onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))} />
          <select className="input-dark" value={form.note_type} onChange={(event) => setForm((f) => ({ ...f, note_type: event.target.value }))}>
            {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="input-dark" value={form.priority} onChange={(event) => setForm((f) => ({ ...f, priority: event.target.value as NotePriority }))}>
            {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="input-dark" value={form.branch} onChange={(event) => setForm((f) => ({ ...f, branch: event.target.value }))}>
            <option>فرع شكري</option>
            <option>فرع الشامي</option>
            <option>كل الفروع</option>
          </select>
          <input className="input-dark" placeholder="اسم العميل إن وجد" value={form.customer_name} onChange={(event) => setForm((f) => ({ ...f, customer_name: event.target.value }))} />
          <input className="input-dark" placeholder="رقم تليفون العميل" value={form.customer_phone} onChange={(event) => setForm((f) => ({ ...f, customer_phone: event.target.value }))} />
          <input className="input-dark" placeholder="رقم الفاتورة إن وجد" value={form.invoice_no} onChange={(event) => setForm((f) => ({ ...f, invoice_no: event.target.value }))} />
          <input className="input-dark" type="datetime-local" value={form.due_at} onChange={(event) => setForm((f) => ({ ...f, due_at: event.target.value }))} />
          <select className="input-dark lg:col-span-2" value={form.assigned_to_name} onChange={(event) => setForm((f) => ({ ...f, assigned_to_name: event.target.value }))}>
            <option value="">الشخص المسؤول عن المتابعة</option>
            {staffChoices.map((person) => <option key={person.id} value={person.name}>{person.name} - {person.branch}</option>)}
          </select>
          <label className="flex items-center gap-2 bg-white/5 rounded-xl px-4 text-slate-200">
            <input type="checkbox" checked={form.is_recurring} onChange={(event) => setForm((f) => ({ ...f, is_recurring: event.target.checked }))} />
            ملحوظة متكررة
          </label>
          <input className="input-dark" type="number" min={1} placeholder="عدد أيام التكرار" value={form.repeat_days} disabled={!form.is_recurring} onChange={(event) => setForm((f) => ({ ...f, repeat_days: Number(event.target.value) }))} />
          <input className="input-dark lg:col-span-2" placeholder="أوقات التكرار مثل 09:00,21:00" value={form.recurrence_times} disabled={!form.is_recurring} onChange={(event) => setForm((f) => ({ ...f, recurrence_times: event.target.value }))} />
          <textarea className="input-dark lg:col-span-4 resize-none" rows={3} placeholder="تفاصيل الملحوظة" value={form.details} onChange={(event) => setForm((f) => ({ ...f, details: event.target.value }))} />
        </div>
        <button onClick={saveNote} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {editing ? "حفظ التعديل" : "إضافة الملحوظة"}
        </button>
      </div>

      <div className="bg-[#1B2B4B] border border-[#2d4063] rounded-2xl p-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
        <input className="input-dark lg:col-span-2" placeholder="بحث بالعميل أو الهاتف أو العنوان أو المسؤول..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input-dark" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">كل الملاحظات</option>
          <option value="mine">ملاحظاتي</option>
          <option value="today">ملاحظات اليوم</option>
          <option value="tomorrow">ملاحظات بكرة</option>
          <option value="overdue">المتأخرة</option>
          <option value="urgent">العاجلة</option>
          <option value="new">جديدة</option>
          <option value="in_progress">قيد التنفيذ</option>
          <option value="completed">مكتملة</option>
          <option value="cancelled">ملغية</option>
        </select>
        <select className="input-dark" value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="today">حسب الفرع/النوع/المسؤول</option>
          <option value="فرع شكري">فرع شكري</option>
          <option value="فرع الشامي">فرع الشامي</option>
          {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {staffChoices.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="stat-card text-slate-300">جاري تحميل ملاحظات الشيفتات...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="stat-card text-center text-slate-400 py-10">لا توجد ملاحظات مطابقة حاليًا.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const phone = cleanEgyptianPhone(note.customer_phone || "");
            return (
              <div key={note.id} className={`rounded-2xl border p-5 ${statusClass(note)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black text-white">{note.title}</div>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      <span className="badge-info">{typeLabels[note.note_type || "general"] || "عام"}</span>
                      <span className="badge-info">{note.branch || "غير محدد"}</span>
                      <span className="badge-info">{priorityLabels[note.priority || "normal"]}</span>
                      <span className="badge-info">{isOverdue(note) ? "متأخرة" : statusLabels[note.status || "new"]}</span>
                      {note.handed_over && <span className="badge-warning">تم تسليمها للشيفت التالي</span>}
                    </div>
                  </div>
                  <button onClick={() => loadDetails(note)} className="btn-secondary text-sm">عرض التفاصيل</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                  <Info icon={UserRound} label="العميل" value={note.customer_name || "لا يوجد"} />
                  <Info icon={Phone} label="الهاتف" value={note.customer_phone || "لا يوجد"} />
                  <Info icon={Clock} label="وقت التنفيذ" value={dateLabel(note.due_at)} />
                  <Info icon={UserRound} label="المسؤول" value={note.assigned_to_name || "غير محدد"} />
                </div>
                {note.details && <p className="text-slate-300 text-sm leading-7 mt-4 line-clamp-2">{note.details}</p>}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => updateStatus(note, "completed")} className="btn-primary text-sm flex items-center gap-2"><CheckCircle2 size={15} /> تم التنفيذ</button>
                  <button onClick={() => startEdit(note)} disabled={!canManage && note.author_name !== user?.name} className="btn-secondary text-sm flex items-center gap-2"><Edit3 size={15} /> تعديل</button>
                  <button onClick={() => updateStatus(note, "cancelled", "إلغاء من المستخدم")} disabled={!canManage && note.author_name !== user?.name} className="btn-secondary text-sm flex items-center gap-2 text-red-200"><Trash2 size={15} /> إلغاء</button>
                  {phone && <a href={generateWhatsAppLink(phone, `مرحبًا، نتابع مع حضرتك بخصوص: ${note.title}`)} target="_blank" rel="noreferrer" className="btn-secondary text-sm flex items-center gap-2"><MessageSquare size={15} /> واتساب</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#10213b] border border-[#2d4063] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 bg-[#10213b] pb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-black text-white">{selected.title}</div>
                <div className="text-slate-400 text-sm mt-1">كتبت بواسطة {selected.author_name || "غير محدد"} - {dateLabel(selected.created_at)}</div>
              </div>
              <button className="btn-secondary" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Detail label="النوع" value={typeLabels[selected.note_type || "general"] || "عام"} />
              <Detail label="الحالة" value={isOverdue(selected) ? "متأخرة" : statusLabels[selected.status || "new"]} />
              <Detail label="الأولوية" value={priorityLabels[selected.priority || "normal"]} />
              <Detail label="الفرع" value={selected.branch || "غير محدد"} />
              <Detail label="المسؤول" value={selected.assigned_to_name || "غير محدد"} />
              <Detail label="وقت التنفيذ" value={dateLabel(selected.due_at)} />
              <Detail label="العميل" value={selected.customer_name || "لا يوجد"} />
              <Detail label="هاتف العميل" value={selected.customer_phone || "لا يوجد"} />
              <Detail label="رقم الفاتورة" value={selected.invoice_no || "لا يوجد"} />
            </div>
            {selected.details && <div className="mt-4 bg-white/5 rounded-xl p-4 text-slate-200 leading-8">{selected.details}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="section-title mb-3">التعليقات وسجل التعديلات</div>
                <div className="flex gap-2 mb-3">
                  <input className="input-dark" placeholder="إضافة تعليق..." value={comment} onChange={(event) => setComment(event.target.value)} />
                  <button onClick={addComment} className="btn-primary">إضافة</button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? <div className="text-slate-400 text-sm">لا يوجد سجل بعد.</div> : logs.map((log) => (
                    <div key={log.id} className="bg-black/15 rounded-lg p-3 text-sm">
                      <div className="text-white font-bold">{log.action} - {log.actor_name || "النظام"}</div>
                      <div className="text-slate-400 text-xs">{dateLabel(log.created_at)}</div>
                      {log.details && <div className="text-slate-300 mt-1">{log.details}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="section-title mb-3">جدول التكرارات</div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {occurrences.length === 0 ? <div className="text-slate-400 text-sm">لا توجد تكرارات لهذه الملحوظة.</div> : occurrences.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 bg-black/15 rounded-lg p-3 text-sm">
                      <span>{dateLabel(item.occurrence_at)}</span>
                      <span className="badge-info">{item.status || "pending"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, danger, success }: { label: string; value: number; danger?: boolean; success?: boolean }) {
  return (
    <div className="stat-card">
      <div className="text-slate-400 text-sm">{label}</div>
      <div className={`text-3xl font-black mt-2 ${danger ? "text-red-300" : success ? "text-emerald-300" : "text-teal-300"}`}>{value}</div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-black/15 rounded-xl p-3">
      <div className="text-slate-400 text-xs flex items-center gap-1"><Icon size={14} /> {label}</div>
      <div className="text-white font-bold mt-1">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-xl p-3">
      <div className="text-slate-400 text-xs">{label}</div>
      <div className="text-white font-bold mt-1">{value}</div>
    </div>
  );
}
