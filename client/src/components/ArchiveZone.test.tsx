// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ArchiveZone } from './ArchiveZone';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn() }),
}));

describe('ArchiveZone', () => {
  it('renders the default "Drag here to archive" label', () => {
    render(<ArchiveZone isOver={false} />);
    expect(screen.getByText('Drag here to archive')).toBeDefined();
  });

  it('shows "Drop to archive" when isOver is true', () => {
    render(<ArchiveZone isOver={true} />);
    expect(screen.getByText('Drop to archive')).toBeDefined();
  });
});
