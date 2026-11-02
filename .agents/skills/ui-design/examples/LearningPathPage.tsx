import { useState, useEffect, useMemo } from "react";
import { Search, Play, Calendar, Clock, BookOpen, Globe, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// ============================================================
// Example: Learning Path List Page (Student)
// Based on WeLearning /student/learning-path pattern
// ============================================================

interface LearningPath {
  id: number;
  title: string;
  description: string;
  image: string;
  isExpired: boolean;
  progress: number;
  duration: string;
  startDate: string;
  endDate: string;
  courseCount: number;
  learningMode: string;
  type: "class" | "path";
}

// --- Filter Bar ---
const TYPE_OPTIONS = [
  { label: "Tất cả", value: "all" },
  { label: "Lớp học", value: "class" },
  { label: "Lộ trình", value: "path" },
] as const;

const SORT_OPTIONS = [
  { label: "Ngày bắt đầu (cũ → mới)", value: "start_date-asc" },
  { label: "Ngày bắt đầu (mới → cũ)", value: "start_date-desc" },
  { label: "Tên A → Z", value: "title-asc" },
  { label: "Tên Z → A", value: "title-desc" },
];

function SearchInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), 500);
    return () => clearTimeout(timer);
  }, [value, onSearch]);
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm kiếm..."
        className="pl-9 h-9 text-sm bg-on-primary-container/20 text-white placeholder:text-white/60 border-none"
      />
    </div>
  );
}

function PathCard({ item }: { item: LearningPath }) {
  const stats = [
    { icon: Clock, label: "Thời lượng", value: item.duration },
    { icon: Calendar, label: "Bắt đầu", value: item.startDate },
    { icon: Calendar, label: "Kết thúc", value: item.endDate },
    { icon: BookOpen, label: "Khóa học", value: String(item.courseCount) },
    { icon: Globe, label: "Hình thức", value: item.learningMode },
  ];

  return (
    <Card className="overflow-hidden transition-all duration-300 h-full hover:shadow-md">
      {/* Image Header */}
      <div className="relative h-48 overflow-hidden group cursor-pointer">
        <img src={item.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        {item.isExpired && <div className="absolute inset-0 bg-black/50 z-[5]" />}
        {/* Tag badges */}
        <span className={`absolute bottom-3 left-3 z-10 text-white text-[11px] px-2 py-0.5 rounded ${item.type === "class" ? "bg-[#4a90e2]" : "bg-[#f5a623]"}`}>
          {item.type === "class" ? "Lớp học" : "Lộ trình"}
        </span>
        {item.isExpired && (
          <span className="absolute top-3 right-3 z-10 text-white text-[11px] px-2 py-0.5 rounded bg-error flex items-center gap-1">
            ⚠ Hết hạn
          </span>
        )}
        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 text-primary ml-0.5" />
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Title */}
        <h3 className="font-bold text-lg text-on-surface leading-tight min-h-[32px] line-clamp-2 hover:text-primary transition-colors cursor-pointer">
          {item.title}
        </h3>

        {/* Description */}
        <p className="text-on-surface-variant text-xs line-clamp-2 min-h-[32px] mt-1">
          {item.description}
        </p>

        {/* Stats Row */}
        <div className="rounded-lg bg-surface-container-lowest flex justify-around my-3 py-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-[11px] w-full border-r border-outline-variant last:border-none px-1">
              <stat.icon className="w-3.5 h-3.5 text-primary mb-1" />
              <span className="font-semibold">{stat.label}</span>
              <span className="text-on-surface-variant">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-on-surface-variant">Tiến độ</span>
            <span className="font-semibold text-secondary">{item.progress}%</span>
          </div>
          <div className="w-full bg-outline-variant/30 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(item.progress, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 w-full text-on-surface-variant/40">
      <PackageOpen className="w-12 h-12 mb-3" />
      <p>Không tìm thấy chương trình phù hợp</p>
    </div>
  );
}

// --- Main Page Component ---
export default function LearningPathPage() {
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("start_date-asc");
  const [items] = useState<LearningPath[]>([]); // Replace with API data

  return (
    <div>
      {/* Title */}
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Lộ trình học tập</h1>

      {/* Filter Bar on colored background */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full justify-between bg-primary p-1 rounded-lg mb-4">
        {/* Type filter buttons (desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant="ghost"
              size="sm"
              className={`text-sm rounded-lg text-white ${type === opt.value ? "bg-on-primary-container" : "hover:bg-on-primary-container/50"}`}
              onClick={() => setType(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Type filter select (mobile) */}
        <select
          className="sm:hidden h-9 rounded-lg bg-on-primary-container/20 text-white text-sm px-3 border-none"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        {/* Search + Sort */}
        <div className="flex items-center gap-4 sm:ml-auto ps-2 sm:border-l border-white/20">
          <SearchInput onSearch={setSearch} />
          <div className="hidden lg:flex items-center gap-2 text-white text-sm">
            <span className="font-medium shrink-0">Sắp xếp:</span>
            <select
              className="h-9 rounded-lg bg-on-primary-container/20 text-white text-sm px-3 border-none"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <PathCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
