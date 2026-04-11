"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { fetchAPI } from "@/lib/api";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ColumnMeta {
  column: string;
  label: string;
  category: string;
  unit?: string;
  source?: string;
}

export default function ExplorePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    return params.toString();
  }, [page, pageSize, startDate, endDate]);

  const {
    data: tableData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["table-data", queryParams],
    queryFn: () => fetchAPI(`/api/data/table?${queryParams}`),
  });

  const { data: columnResponse } = useQuery({
    queryKey: ["columns"],
    queryFn: () => fetchAPI("/api/data/columns"),
  });
  const columnMeta: ColumnMeta[] | undefined = columnResponse?.columns;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [pageSize, startDate, endDate]);

  const columnMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (columnMeta) {
      for (const col of columnMeta) {
        map[col.column] = col.label;
      }
    }
    return map;
  }, [columnMeta]);

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!tableData?.data?.length) return [];
    const keys = Object.keys(tableData.data[0]);
    return keys.map((key) => ({
      accessorKey: key,
      header: () => (
        <span title={columnMap[key] || key} className="cursor-help">
          {columnMap[key] || key}
        </span>
      ),
      cell: ({ getValue }) => {
        const v = getValue();
        if (v === null || v === undefined) return <span className="text-slate-600">--</span>;
        if (typeof v === "number") return v.toFixed(4);
        return String(v);
      },
    }));
  }, [tableData, columnMap]);

  const table = useReactTable({
    data: tableData?.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totalPages = tableData?.total_pages ?? 1;

  return (
    <div className="mx-auto max-w-[95rem] space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
          <Table2 className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Data Explorer</h1>
          <p className="text-sm text-slate-400">
            Browse and filter the dataset with {tableData?.total ?? "..."} rows
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Rows per page
          </label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : error ? (
        <div className="flex h-96 items-center justify-center gap-2 text-rose-400">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load data. Is the backend running?</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-800 bg-slate-900">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400 hover:text-slate-200"
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-blue-400" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="h-3 w-3 text-blue-400" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-slate-600" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-slate-800/50 transition-colors hover:bg-slate-800/50",
                    i % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-300"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
