// src/pages/decomptes/PrintRecuDecompte.tsx

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Group,
  Loader,
  Center,
  Paper,
  Stack
} from "@mantine/core";

import {
  IconPrinter,
  IconFileDownload
} from "@tabler/icons-react";

import RecuDecompte from "../../components/decomptes/RecuDecompte";
import RecuDecompteService from "../../services/RecuDecompteService";

interface PrintRecuDecompteProps {
  idDecompte: number;
}

export default function PrintRecuDecompte({
  idDecompte
}: PrintRecuDecompteProps) {

  const printRef =
    useRef<HTMLDivElement>(null);

  const [loading, setLoading] =
    useState(true);

  const [recu, setRecu] =
    useState<any>(null);

  useEffect(() => {

    charger();

  }, [idDecompte]);

  const charger = async () => {

    try {

      setLoading(true);

      const data =
        await RecuDecompteService
          .getRecuDecompte(idDecompte);

      setRecu(data);

    } catch (error) {

      console.error(
        "Erreur chargement reçu",
        error
      );

    } finally {

      setLoading(false);

    }
  };

  const handlePrint = () => {

    const content =
      printRef.current;

    if (!content) return;

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=1200,height=900"
      );

    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
        <title>Reçu Décompte</title>

        <style>

          body{
            font-family: Arial, sans-serif;
            margin:20px;
          }

          table{
            width:100%;
            border-collapse:collapse;
          }

          th,td{
            border:1px solid black;
            padding:4px;
            text-align:center;
          }

        </style>

      </head>

      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {

      printWindow.print();

      printWindow.close();

    }, 500);
  };

  const handleExportPdf = () => {

    // A remplacer plus tard par jsPDF
    handlePrint();

  };

  if (loading) {

    return (
      <Center h={300}>
        <Loader />
      </Center>
    );
  }

  if (!recu) {

    return (
      <Center h={300}>
        Impossible de charger
        le reçu.
      </Center>
    );
  }

  return (

    <Stack>

      <Group justify="flex-end">

        <Button
          leftSection={
            <IconPrinter size={16} />
          }
          onClick={handlePrint}
        >
          Imprimer
        </Button>

        <Button
          variant="outline"
          leftSection={
            <IconFileDownload size={16} />
          }
          onClick={handleExportPdf}
        >
          Export PDF
        </Button>

      </Group>

      <Paper
        shadow="sm"
        p="md"
      >

        <div ref={printRef}>

          <RecuDecompte

            numero={
              recu.header.code_decompte
            }

            date={
              recu.header.date_decompte
            }

            client={
              recu.header.NomComplet
            }

            details={
              recu.details
            }

          />

        </div>

      </Paper>

    </Stack>
  );
}