import { useCallback, useEffect, useRef, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { useEmpresa } from '@/contexts/EmpresaContext';

const STORAGE_PREFIX = 'crm-leads-page-filters';

interface PersistedLeadsFilters {
  statusFilter: string;
  searchTerm: string;
  dateFrom?: string;
  dateTo?: string;
}

function storageKey(schemaEmpresa: string | null) {
  return `${STORAGE_PREFIX}:${schemaEmpresa ?? 'master'}`;
}

function getDefaultDateRange(): DateRange {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: firstDay, to: today };
}

function loadPersisted(schemaEmpresa: string | null): PersistedLeadsFilters | null {
  try {
    const raw = localStorage.getItem(storageKey(schemaEmpresa));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedLeadsFilters;
  } catch {
    return null;
  }
}

function parseDateRange(saved: PersistedLeadsFilters): DateRange | undefined {
  if (!saved.dateFrom) return undefined;
  const from = new Date(saved.dateFrom);
  if (Number.isNaN(from.getTime())) return undefined;
  const to = saved.dateTo ? new Date(saved.dateTo) : undefined;
  if (to && Number.isNaN(to.getTime())) {
    return { from };
  }
  return { from, to };
}

function serializeDateRange(range: DateRange | undefined): Pick<PersistedLeadsFilters, 'dateFrom' | 'dateTo'> {
  if (!range?.from) return {};
  return {
    dateFrom: range.from.toISOString(),
    dateTo: range.to?.toISOString(),
  };
}

function isDefaultMonthRange(range: DateRange | undefined): boolean {
  if (!range?.from) return false;
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDay.setHours(0, 0, 0, 0);
  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);
  const to = range.to ? new Date(range.to) : today;
  to.setHours(0, 0, 0, 0);
  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);
  return from.getTime() === firstDay.getTime() && to.getTime() === todayNorm.getTime();
}

export function useLeadsPageFilters() {
  const { schemaEmpresa } = useEmpresa();
  const hydratedRef = useRef(false);
  const skipNextPersistRef = useRef(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getDefaultDateRange);

  useEffect(() => {
    hydratedRef.current = false;
    const saved = loadPersisted(schemaEmpresa);
    skipNextPersistRef.current = true;
    if (saved) {
      setSearchTerm(saved.searchTerm ?? '');
      setStatusFilter(saved.statusFilter ?? 'all');
      const parsed = parseDateRange(saved);
      setDateRange(parsed ?? getDefaultDateRange());
    } else {
      setSearchTerm('');
      setStatusFilter('all');
      setDateRange(getDefaultDateRange());
    }
    hydratedRef.current = true;
  }, [schemaEmpresa]);

  useEffect(() => {
    if (!hydratedRef.current || skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    const payload: PersistedLeadsFilters = {
      statusFilter,
      searchTerm,
      ...serializeDateRange(dateRange),
    };
    try {
      localStorage.setItem(storageKey(schemaEmpresa), JSON.stringify(payload));
    } catch {
      /* quota / modo privado */
    }
  }, [statusFilter, searchTerm, dateRange, schemaEmpresa]);

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setDateRange(getDefaultDateRange());
    setSearchTerm('');
    try {
      localStorage.removeItem(storageKey(schemaEmpresa));
    } catch {
      /* ignore */
    }
  }, [schemaEmpresa]);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    Boolean(searchTerm.trim()) ||
    !isDefaultMonthRange(dateRange);

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    resetFilters,
    hasActiveFilters,
    isDefaultMonthRange,
  };
}
