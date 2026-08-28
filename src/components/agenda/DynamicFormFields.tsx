import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/hooks/useAgendaFormFields';
import { cn } from '@/lib/utils';

interface DynamicFormFieldsProps {
  fields: FormField[];
  register: UseFormRegister<any>;
  errors: FieldErrors;
}

export function DynamicFormFields({ fields, register, errors }: DynamicFormFieldsProps) {
  const getInputType = (fieldType: string): string => {
    switch (fieldType) {
      case 'email':
        return 'email';
      case 'tel':
        return 'tel';
      case 'number':
        return 'number';
      case 'date':
        return 'date';
      default:
        return 'text';
    }
  };

  const getInputMode = (fieldType: string): 'text' | 'email' | 'tel' | 'numeric' | undefined => {
    switch (fieldType) {
      case 'email':
        return 'email';
      case 'tel':
        return 'tel';
      case 'number':
        return 'numeric';
      default:
        return 'text';
    }
  };

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const error = errors[field.field_key];
        const errorMessage = error?.message as string | undefined;

        return (
          <div key={field.id} className="space-y-2">
            <Label
              htmlFor={field.field_key}
              className={cn(error && 'text-destructive')}
            >
              {field.field_label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={field.field_key}
              type={getInputType(field.field_type)}
              inputMode={getInputMode(field.field_type)}
              placeholder={field.placeholder || undefined}
              {...register(field.field_key)}
              className={cn(
                error && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            {errorMessage && (
              <p className="text-xs text-destructive">{errorMessage}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
