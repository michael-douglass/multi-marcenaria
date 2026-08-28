import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OPERATIONAL_ROLES, roleLabel, normalizeRoles } from '@/lib/app-roles';
import type { AppUserRole } from '@/lib/resolve-auth-role';

interface RoleMultiSelectProps {
  value: AppUserRole[];
  onChange: (roles: AppUserRole[]) => void;
  idPrefix?: string;
}

export function RoleMultiSelect({
  value,
  onChange,
  idPrefix = 'role',
}: RoleMultiSelectProps) {
  const selected = normalizeRoles(value);

  const toggle = (role: AppUserRole, checked: boolean) => {
    if (checked) {
      onChange(normalizeRoles([...selected.filter((r) => r !== 'nenhum'), role]));
      return;
    }
    const next = selected.filter((r) => r !== role);
    onChange(normalizeRoles(next.length ? next : ['nenhum']));
  };

  return (
    <div className="space-y-2 rounded-md border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">
        Marque uma ou mais. Ex.: Vendedor + Projetista libera vendas e a prancheta.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {OPERATIONAL_ROLES.map((role) => {
          const checkboxId = `${idPrefix}-${role}`;
          const isChecked = selected.includes(role);
          return (
            <label
              key={role}
              htmlFor={checkboxId}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50"
            >
              <Checkbox
                id={checkboxId}
                checked={isChecked}
                onCheckedChange={(state) => toggle(role, state === true)}
              />
              <Label htmlFor={checkboxId} className="cursor-pointer font-normal">
                {roleLabel(role)}
              </Label>
            </label>
          );
        })}
      </div>
    </div>
  );
}
