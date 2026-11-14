import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Department } from '../../types/database';
import {
  filterDepartments,
  formatDepartmentLabel,
  prepareDepartmentOptions,
} from '../../utils/departments';

interface SearchableDepartmentSelectProps {
  id?: string;
  value: string;
  onChange: (departmentId: string) => void;
  departments: Department[];
  legacySelectedDepartment?: Department | null;
  placeholder?: string;
  emptyOptionLabel?: string;
  allowClear?: boolean;
  compact?: boolean;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
  describedBy?: string;
}

export function SearchableDepartmentSelect({
  id,
  value,
  onChange,
  departments,
  legacySelectedDepartment = null,
  placeholder = 'Select Your Department',
  emptyOptionLabel,
  allowClear = false,
  compact = false,
  required = false,
  disabled = false,
  hasError = false,
  describedBy,
}: SearchableDepartmentSelectProps) {
  const generatedId = useId();
  const controlId = id || `dept-select-${generatedId}`;
  const listboxId = `${controlId}-listbox`;

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const options = useMemo(
    () => prepareDepartmentOptions(departments, legacySelectedDepartment),
    [departments, legacySelectedDepartment]
  );

  const filteredOptions = useMemo(
    () => filterDepartments(options, searchQuery),
    [options, searchQuery]
  );

  const selectedDept = useMemo(
    () => options.find((d) => d.id === value) || null,
    [options, value]
  );

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const selectedIdx = options.findIndex((d) => d.id === value);
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } else {
      setSearchQuery('');
    }
  }, [open, options, value]);

  const handleSelect = (deptId: string) => {
    onChange(deptId);
    setOpen(false);
    setSearchQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length === 0 ? 0 : (prev + 1) % filteredOptions.length
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredOptions.length === 0
          ? 0
          : (prev - 1 + filteredOptions.length) % filteredOptions.length
      );
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredOptions[highlightedIndex];
      if (target) {
        handleSelect(target.id);
      }
    }
  };

  const displayValue = selectedDept
    ? formatDepartmentLabel(selectedDept)
    : emptyOptionLabel && !value
      ? emptyOptionLabel
      : placeholder;

  return (
    <div ref={containerRef} className={`relative w-full ${compact ? 'mt-1.5' : 'mt-1.5'}`} onKeyDown={handleKeyDown}>
      <button
        id={controlId}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-required={required}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#C62828]/20 dark:bg-slate-950 ${
          compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
        } ${
          hasError
            ? 'border-red-500 focus:border-red-600 dark:border-red-500'
            : open
              ? 'border-[#C62828] dark:border-red-500'
              : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            selectedDept || (emptyOptionLabel && !value)
              ? 'text-slate-900 dark:text-white'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {displayValue}
        </span>

        <span className="flex shrink-0 items-center gap-1">
          {allowClear && value && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear department selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform duration-150 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Search Bar */}
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Search department..."
                aria-label="Search department"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#C62828] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Netrokona University Departments"
            className="max-h-60 overflow-y-auto overscroll-contain py-1"
          >
            {allowClear && emptyOptionLabel && !searchQuery.trim() && (
              <li
                role="option"
                aria-selected={!value}
                onClick={() => handleSelect('')}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors ${
                  !value
                    ? 'bg-red-50 font-semibold text-[#C62828] dark:bg-red-950/40 dark:text-red-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{emptyOptionLabel}</span>
                {!value && <Check className="h-4 w-4 shrink-0" />}
              </li>
            )}

            {filteredOptions.length === 0 ? (
              <li className="px-3.5 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                {options.length === 0
                  ? 'No active departments loaded.'
                  : `No department matching "${searchQuery}".`}
              </li>
            ) : (
              filteredOptions.map((dept, index) => {
                const label = formatDepartmentLabel(dept);
                const isSelected = dept.id === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={dept.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(dept.id)}
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition-colors ${
                      isSelected
                        ? 'bg-red-50 font-semibold text-[#C62828] dark:bg-red-950/40 dark:text-red-300'
                        : isHighlighted
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="min-w-0 flex-1 break-words leading-snug">
                      {label}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
