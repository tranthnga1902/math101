import { useState, useEffect, useMemo } from "react";
import { Search, Play, Calendar, RefreshCw, HelpCircle, Clock, PackageOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// ============================================================
// Example: List Page with Filters, Grid Cards, Pagination
// Based on WeLearning /student/my-exams UI structure
// ============================================================

// --- Types ---
interface ExamItem {
  id: string;
  title: string;
  sessionTitle: string;
  startTime: string;
  endTime: string;
  questionsCount: number;
  duration: number;
  attempts: number;
  maxAttempts: number | null;
  image?: string;
  isExpired: boolean;
}

// --- Status Filter Tabs ---
const STATUS_OPTIONS = [
  { label: "Tất cả",       value: "all",        color: "#2563eb" },
  { label: "Đang diễn ra", value: "inprogress", color: "#00B8DB" },
  { label: "Đã lên lịch",  value: "scheduled",  color: "#F59E0B" },
  { label: "Hoàn thành",   value: "completed",  color: "#10B981" },
] as const;

// --- Subcomponents ---

function SearchInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), 500);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="relative grow md:grow-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm kiếm bài thi..."
        className="pl-9 h-9 text-sm"
      />
    </div>
  );
}

function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
            transition-all duration-200 border
            ${value === opt.value
              ? "text-white border-transparent shadow-sm"
              : "text-gray-600 border-gray-200 hover:border-gray-300 bg-white"
            }
          `}
          style={value === opt.value ? { backgroundColor: opt.color } : undefined}
        >
          {opt.label}
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            value === opt.value ? "bg-white/20" : "bg-gray-100"
          }`}>
            {counts[opt.value] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

function ExamCard({ exam, onStart }: { exam: ExamItem; onStart: () => void }) {
  const stats = [
    { icon: HelpCircle, label: "Câu hỏi", value: String(exam.questionsCount) },
    { icon: Clock, label: "Thời lượng", value: `${exam.duration}p` },
    { icon: RefreshCw, label: "Lượt thi", value: String(exam.attempts) },
  ];

  const infoRows = [
    { icon: Calendar, label: "Phiên thi", value: exam.sessionTitle },
    { icon: Calendar, label: "Bắt đầu", value: exam.startTime },
    { icon: Calendar, label: "Kết thúc", value: exam.endTime, isExpired: exam.isExpired },
    {
      icon: RefreshCw,
      label: "Lượt thi",
      value: exam.maxAttempts ? `${exam.attempts}/${exam.maxAttempts}` : "Không giới hạn",
    },
  ];

  return (
    <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-md p-4 flex flex-col">
      {/* Title */}
      <h3 className="h-[48px] text-base font-bold text-gray-800 line-clamp-2
                     hover:text-blue-600 cursor-pointer transition-all duration-200">
        {exam.title}
      </h3>

      {/* Stat Badges */}
      <div className="flex gap-2 my-3">
        {stats.map((stat) => (
          <span
            key={stat.label}
            title={stat.label}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs
                       border rounded-md text-gray-600 bg-gray-50"
          >
            <stat.icon className="w-3 h-3" />
            {stat.value}
          </span>
        ))}
      </div>

      <hr className="border-gray-100" />

      {/* Info Rows */}
      <div className="space-y-1.5 mt-3 text-sm flex-1
                     sm:min-h-[180px] lg:min-h-[150px] xl:min-h-[180px]">
        {infoRows.map((row) => (
          <div key={row.label} className="flex">
            <span className="min-w-20 font-medium text-gray-700 flex items-center gap-1">
              <row.icon className="w-3.5 h-3.5 text-blue-600" />
              {row.label}
            </span>
            <span className="mr-2 text-gray-300">:</span>
            <span className={`line-clamp-2 ${
              row.isExpired ? "text-red-500 font-medium" : "text-gray-500"
            }`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Action */}
      <Button className="w-full mt-4" onClick={onStart}>
        <Play className="w-4 h-4 mr-2" />
        Tham gia
      </Button>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 w-full text-gray-400">
      <PackageOpen className="w-12 h-12 mb-3" />
      <p>Không có dữ liệu</p>
    </div>
  );
}

// --- Main Page Component ---

export default function ExamListPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [exams] = useState<ExamItem[]>([]); // Replace with API data
  const [loading, setLoading] = useState(false);

  const counts = useMemo(() => ({
    all: 12,
    inprogress: 3,
    scheduled: 5,
    completed: 4,
  }), []);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between mb-4 gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Danh sách bài thi</h1>
        <SearchInput onSearch={setSearch} />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-5 justify-between items-center">
        <StatusTabs value={status} onChange={setStatus} counts={counts} />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Sắp xếp:</span>
          <Button variant="outline" size="sm" className="gap-1">
            Mới nhất <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      {exams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-5">
          {exams.map((exam) => (
            <ExamCard key={exam.id} exam={exam} onStart={() => console.log("Start", exam.id)} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
