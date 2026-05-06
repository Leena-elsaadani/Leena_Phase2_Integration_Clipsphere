import { useState, useCallback } from 'react';
import { z } from 'zod';

type Errors<T> = Partial<Record<keyof T, string>>;

export function useForm<T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  initialValues: T
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Errors<T>>({});

  const handleChange = useCallback(
    (field: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      // Clear error on change
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    []
  );

  const validate = useCallback((): boolean => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    const newErrors: Errors<T> = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as keyof T;
      if (!newErrors[field]) newErrors[field] = issue.message;
    });
    setErrors(newErrors);
    return false;
  }, [schema, values]);

  const isValid = schema.safeParse(values).success;

  return { values, setValues, errors, handleChange, validate, isValid };
}