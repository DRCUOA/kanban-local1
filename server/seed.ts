import { SEED_STAGE_NAMES, STAGE_KIND } from '@shared/constants';
import { logger } from '@shared/logger';
import type { IStorage } from './storage';

export async function seedDatabase(storage: IStorage): Promise<void> {
  const existingStages = await storage.getStages();
  if (existingStages.length === 0) {
    // `kind` is stated, not inferred from the name beside it (EPIC-03 story 1).
    const backlogStage = await storage.createStage({
      name: SEED_STAGE_NAMES.BACKLOG,
      order: 1,
      kind: STAGE_KIND.BACKLOG,
    });
    const inProgressStage = await storage.createStage({
      name: SEED_STAGE_NAMES.IN_PROGRESS,
      order: 2,
      kind: STAGE_KIND.IN_PROGRESS,
    });
    const doneStage = await storage.createStage({
      name: SEED_STAGE_NAMES.DONE,
      order: 3,
      kind: STAGE_KIND.DONE,
    });

    await storage.createTask({
      title: 'Research competitors',
      description: 'Look at Trello, Jira, Asana',
      stageId: backlogStage.id,
    });
    await storage.createTask({
      title: 'Set up project repo',
      description: 'Initialize Git and basic structure',
      stageId: inProgressStage.id,
    });
    await storage.createTask({
      title: 'Ideation phase',
      description: 'Brainstorm core features',
      stageId: doneStage.id,
    });
    logger.info('Seeded database with initial stages and tasks');
  }
}
