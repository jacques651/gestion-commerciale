// src/components/common/PageHeader.tsx
// Composant d'en-tête partagé — compact, cohérent sur toutes les pages

import React from 'react';
import { Box, Group, Text, SimpleGrid, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

interface StatCard {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
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
  title, subtitle, color = 'blue', stats = [], action, extra
}) => {
  // Thème « Vert-ardoise » : le titre est porté par la bannière de page (PageBanner),
  // il reste ici uniquement pour les lecteurs d'écran.
  return (
    <Box className="tk-page-tools" mb="md">
      <span className="tk-sr-only">{title}{subtitle ? ` : ${subtitle}` : ''}</span>

      {(extra || action) && (
        <Group justify="flex-end" gap="xs" wrap="wrap" mb={stats.length > 0 ? 'md' : 0}>
          {extra}
          {action && (
            <Button
              size="sm"
              leftSection={action.icon ?? <IconPlus size={14} />}
              color={action.color ?? color}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
        </Group>
      )}

      {stats.length > 0 && (
        <SimpleGrid cols={{ base: Math.min(2, stats.length), sm: stats.length }} spacing="sm">
          {stats.map((s, i) => (
            <Box
              key={i}
              className="tk-kpi"
              p="sm"
              onClick={s.onClick}
              style={{ cursor: s.onClick ? 'pointer' : 'default', minWidth: 0 }}
            >
              <Group gap="sm" wrap="nowrap" align="center">
                {s.icon && <span className="tk-kpi-icon">{s.icon}</span>}
                <Box style={{ minWidth: 0 }}>
                  <Text className="tk-kpi-label">{s.label}</Text>
                  <Text className="tk-kpi-value" fw={700} size="lg">{s.value}</Text>
                </Box>
              </Group>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
};
