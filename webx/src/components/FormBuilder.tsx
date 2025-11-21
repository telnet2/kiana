'use client';

import { useRef, useState } from 'react';

export interface FormConfig {
  formId: string;
  html: string;
  title?: string;
}

/**
 * FormBuilder Component
 *
 * Renders raw HTML form string and handles form submission.
 * Extracts form data, applies HTML5 validation, and returns JSON to the callback.
 */
export function FormBuilder({
  config,
  onSubmit,
}: {
  config: FormConfig;
  onSubmit?: (data: Record<string, any>) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationErrors({});

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const errors: Record<string, string> = {};

    // Validate form inputs
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach((input: any) => {
      const name = input.name || input.id;
      if (!name) return;

      // Check required
      if (input.required && !input.value?.trim()) {
        errors[name] = 'This field is required';
        return;
      }

      // Check email type
      if (input.type === 'email' && input.value?.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(input.value)) {
          errors[name] = 'Please enter a valid email address';
          return;
        }
      }

      // Check pattern attribute
      if (input.pattern && input.value?.trim()) {
        const pattern = new RegExp(input.pattern);
        if (!pattern.test(input.value)) {
          errors[name] = input.title || 'Please match the required format';
          return;
        }
      }

      // Check minlength
      if (input.minLength && input.value?.length < input.minLength) {
        errors[name] = `Minimum length is ${input.minLength}`;
        return;
      }

      // Check maxlength (maxLength returns -1 if not set)
      if (input.maxLength && input.maxLength > 0 && input.value?.length > input.maxLength) {
        errors[name] = `Maximum length is ${input.maxLength}`;
        return;
      }

      // Check min (for numbers, dates)
      if (input.min !== null && input.min !== undefined && input.min !== '') {
        const val = input.type === 'number' ? parseFloat(input.value) : input.value;
        const min = input.type === 'number' ? parseFloat(input.min) : input.min;
        if (input.value && val < min) {
          errors[name] = `Minimum value is ${input.min}`;
          return;
        }
      }

      // Check max (for numbers, dates)
      if (input.max !== null && input.max !== undefined && input.max !== '') {
        const val = input.type === 'number' ? parseFloat(input.value) : input.value;
        const max = input.type === 'number' ? parseFloat(input.max) : input.max;
        if (input.value && val > max) {
          errors[name] = `Maximum value is ${input.max}`;
          return;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Serialize form data to JSON
    const formJson: Record<string, any> = {};
    formData.forEach((value, key) => {
      if (formJson[key]) {
        // Handle multiple values for same name (like checkboxes)
        if (Array.isArray(formJson[key])) {
          formJson[key].push(value);
        } else {
          formJson[key] = [formJson[key], value];
        }
      } else {
        formJson[key] = value;
      }
    });

    setIsSubmitting(true);
    onSubmit?.(formJson);
  };

  return (
    <div className="my-4 rounded-lg bg-bg-subtle p-6 border border-bg-panel shadow-lg">
      {config.title && (
        <h3 className="text-lg font-bold mb-4 text-text-default">{config.title}</h3>
      )}

      <div
        ref={containerRef}
        className="form-container"
        style={{
          display: 'contents',
          color: '#000',
        }}
      >
        <form
          className="space-y-4"
          dangerouslySetInnerHTML={{ __html: config.html }}
          onSubmit={handleSubmit}
          style={{
            color: '#000',
          }}
        />
      </div>

      <style>{`
        .form-container input,
        .form-container textarea,
        .form-container select {
          color: #000 !important;
          background-color: #fff !important;
        }
        .form-container label {
          color: #fff !important;
        }
        .form-container button {
          color: #fff !important;
          background-color: #0066cc !important;
        }
      `}</style>

      {/* Display validation errors */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="mt-4 p-3 bg-red-900 bg-opacity-20 border border-red-500 rounded text-red-300 text-sm space-y-1">
          {Object.entries(validationErrors).map(([field, error]) => (
            <div key={field}>
              <strong>{field}:</strong> {error}
            </div>
          ))}
        </div>
      )}

      {isSubmitting && (
        <div className="mt-4 p-3 bg-green-900 bg-opacity-20 border border-green-500 rounded text-green-300 text-sm">
          Form submitted successfully!
        </div>
      )}
    </div>
  );
}
