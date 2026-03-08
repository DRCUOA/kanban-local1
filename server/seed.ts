import { SEED_STAGE_NAMES } from '@shared/constants';
import type { IStorage } from './storage';

export async function seedDatabase(storage: IStorage): Promise<void> {
  const existingStages = await storage.getStages();
  if (existingStages.length === 0) {
    const backlogStage = await storage.createStage({
      name: SEED_STAGE_NAMES.BACKLOG,
      order: 1,
    });
    const inProgressStage = await storage.createStage({
      name: SEED_STAGE_NAMES.IN_PROGRESS,
      order: 2,
    });
    const doneStage = await storage.createStage({
      name: SEED_STAGE_NAMES.DONE,
      order: 3,
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
    console.log('Seeded database with initial stages and tasks');
  }
}
