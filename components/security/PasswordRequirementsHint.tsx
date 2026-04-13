'use client';

import { useState } from 'react';
import type { PasswordRuleCheck } from '@/lib/security/passwordRules';

type PasswordRequirementsHintProps = {
  rules: PasswordRuleCheck[];
  title?: string;
};

export function PasswordRequirementsHint({
  rules,
  title = 'Requisitos minimos'
}: PasswordRequirementsHintProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <button
        type="button"
        aria-label="Ver requisitos de contraseña"
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[#C8D0DB] text-[10px] leading-none text-[#6F7782]"
        style={{ borderWidth: '0.5px' }}
      >
        !
      </button>

      {isVisible && (
        <div
          className="absolute left-0 top-6 z-30 w-[260px] rounded-[8px] border border-[#D3D9E1] bg-white p-3 shadow-sm"
          style={{ borderWidth: '0.5px' }}
        >
          <p className="text-[11px] text-[#4A525E] font-medium">{title}</p>
          <ul className="mt-2 space-y-1">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-2 text-[11px]">
                <span className={rule.passed ? 'text-[#1D9E75]' : 'text-[#B42318]'}>
                  {rule.passed ? '✓' : 'x'}
                </span>
                <span className={rule.passed ? 'text-[#1D9E75]' : 'text-[#6F7782]'}>
                  {rule.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
