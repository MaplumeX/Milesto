import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
  'aria-label'?: string
  disabled?: boolean
  'data-testid'?: string
}

export function Select({
  value,
  options,
  onValueChange,
  'aria-label': ariaLabel,
  disabled,
  'data-testid': dataTestId,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        className="select-trigger"
        aria-label={ariaLabel}
        data-testid={dataTestId}
      >
        <RadixSelect.Value />
        <RadixSelect.Icon className="select-icon">
          <ChevronDown size={10} strokeWidth={1.5} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="select-content" position="popper" sideOffset={4}>
          <RadixSelect.Viewport className="select-viewport">
            {options.map((option) => (
              <RadixSelect.Item key={option.value} value={option.value} className="select-item">
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="select-item-indicator">
                  <Check size={10} strokeWidth={1.5} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
