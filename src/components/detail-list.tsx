import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {items.map(({ label, value }, index) => (
        <div key={index}>
          <dt>
            <Text as="span" type="supporting">
              {label}
            </Text>
          </dt>
          <dd>
            <Text as="div" display="block">
              {value}
            </Text>
          </dd>
        </div>
      ))}
    </dl>
  );
}
