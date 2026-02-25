import type { RAGStatus } from '../types';

export function calculateRAG(actual: number, target: number): RAGStatus {
  if (target === 0) return 'green';
  const percentage = (actual / target) * 100;
  if (percentage >= 100) return 'green';
  if (percentage >= 80) return 'amber';
  return 'red';
}

export function ragToColour(rag: RAGStatus): string {
  switch (rag) {
    case 'green': return '#22c55e';
    case 'amber': return '#f59e0b';
    case 'red': return '#ef4444';
  }
}

export function ragToTailwindClass(rag: RAGStatus): string {
  switch (rag) {
    case 'green': return 'text-green-500';
    case 'amber': return 'text-amber-500';
    case 'red': return 'text-red-500';
  }
}

export function ragToBgTailwindClass(rag: RAGStatus): string {
  switch (rag) {
    case 'green': return 'bg-green-500';
    case 'amber': return 'bg-amber-500';
    case 'red': return 'bg-red-500';
  }
}
