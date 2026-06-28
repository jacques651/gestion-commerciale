// src/components/common/PageHeader.tsx
// Composant d'en-tête partagé — compact, cohérent sur toutes les pages

import React from 'react';
import { Box, Group, Text, ThemeIcon, SimpleGrid, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

interface StatCard {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  stats?: StatCard[];
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    color?: string;
  };
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title, subtitle, icon, color = 'blue', stats = [], action, extra
}) => {
  return (
    <Box
      p="md"
      mb="md"
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #122040 60%, #1b365d 100%)',
        borderRadius: 12,
      }}
    >
      {/* Ligne titre + bouton */}
      <Group justify="space-between" mb={stats.length > 0 ? 'md' : 0} wrap="wrap">
        <Group gap="sm">
          <ThemeIcon size={36} radius="md" color={color} variant="filled" style={{ opacity: 0.9 }}>
            {icon}
          </ThemeIcon>
          <Box>
            <Text fw={700} c="white" size="md" lh={1.2}>{title}</Text>
            {subtitle && <Text size="xs" c="rgba(255,255,255,0.5)" mt={2}>{subtitle}</Text>}
          </Box>
        </Group>
        <Group gap="xs">
          {extra}
          {action && (
            <Button
              size="sm"
              leftSection={action.icon ?? <IconPlus size={14} />}
              variant="gradient"
              gradient={{ from: action.color ?? color, to: action.color === 'green' ? 'teal' : 'cyan' }}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </Group>
      </Group>

      {/* Stats en ligne fine */}
      {stats.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: Math.min(stats.length, 4) }} spacing="xs">
          {stats.map((s, i) => (
            <Box
              key={i}
              p="xs"
              style={{ borderRadius: 8, background: 'rgba(255,255,255,0.07)' }}
            >
              <Group gap={6} mb={2}>
                {s.icon && (
                  <Box style={{ color: s.color ?? 'rgba(255,255,255,0.5)', display: 'flex' }}>
                    {s.icon}
                  </Box>
                )}
                <Text size="xs" c="rgba(255,255,255,0.5)">{s.label}</Text>
              </Group>
              <Text fw={700} c="white" size="sm">{s.value}</Text>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
};
