// src/components/dashboard/ChartStats.tsx
import React, { useEffect, useState } from 'react';
import { Card, Title, Text, Group, Select, LoadingOverlay, SimpleGrid } from '@mantine/core';
import { getDb } from '../../database/db';

export const ChartStats: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');
  const [stats, setStats] = useState({
    totalVentes: 0,
    totalCA: 0,
    avgVente: 0
  });

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const db = await getDb();
      
      const result = await db.select<any[]>(`
        SELECT 
          COUNT(*) as nb_ventes,
          COALESCE(SUM(montant_total), 0) as total_ca,
          COALESCE(AVG(montant_total), 0) as avg_vente
        FROM ventes
        WHERE date(date_vente) >= date('now', '-' || ? || ' days')
      `, [period]);
      
      if (result.length > 0) {
        setStats({
          totalVentes: result[0].nb_ventes,
          totalCA: result[0].total_ca,
          avgVente: result[0].avg_vente
        });
      }
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;

  return (
    <Card withBorder p="lg" pos="relative">
      <LoadingOverlay visible={loading} />
      
      <Group justify="space-between" mb="md">
        <Title order={4}>📊 Statistiques</Title>
        <Select
          value={period}
          onChange={(value) => setPeriod(value || '7')}
          data={[
            { value: '7', label: '7 jours' },
            { value: '30', label: '30 jours' },
            { value: '90', label: '90 jours' },
          ]}
          size="sm"
          style={{ width: 120 }}
        />
      </Group>
      
      <SimpleGrid cols={3} spacing="md">
        <Card withBorder p="md" ta="center">
          <Text size="xs" c="dimmed">Nombre de ventes</Text>
          <Text fw={700} size="xl">{stats.totalVentes}</Text>
        </Card>
        <Card withBorder p="md" ta="center">
          <Text size="xs" c="dimmed">Chiffre d'affaires</Text>
          <Text fw={700} size="xl" c="green">{formatCurrency(stats.totalCA)}</Text>
        </Card>
        <Card withBorder p="md" ta="center">
          <Text size="xs" c="dimmed">Panier moyen</Text>
          <Text fw={700} size="xl" c="blue">{formatCurrency(stats.avgVente)}</Text>
        </Card>
      </SimpleGrid>
    </Card>
  );
};