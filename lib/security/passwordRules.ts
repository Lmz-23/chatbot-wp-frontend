export type PasswordRuleCheck = {
  id: string;
  label: string;
  passed: boolean;
};

export function evaluatePasswordRules(password: string): PasswordRuleCheck[] {
  return [
    {
      id: 'min_len',
      label: 'Minimo 8 caracteres',
      passed: password.length >= 8
    },
    {
      id: 'upper',
      label: 'Al menos 1 letra mayuscula',
      passed: /[A-Z]/.test(password)
    },
    {
      id: 'lower',
      label: 'Al menos 1 letra minuscula',
      passed: /[a-z]/.test(password)
    },
    {
      id: 'number',
      label: 'Al menos 1 numero',
      passed: /[0-9]/.test(password)
    }
  ];
}

export function hasFailedPasswordRule(rules: PasswordRuleCheck[]) {
  return rules.some((rule) => !rule.passed);
}
