# Task Status Data Model Inconsistency Investigation Report

## Executive Summary
**Issue Confirmed**: There is a data model inconsistency between the task status values defined in the schema and the stage (column) names displayed on the Kanban board UI.

## Root Cause Analysis

### 1. Data Model Definition (Schema)
**Location**: `/shared/schema.ts` (lines 25-27)

The task status is defined as an enum with **4 specific values**:
```typescript
export const taskStatusEnum = z.enum(["backlog", "in_progress", "done", "abandoned"]);
```

These status values are:
1. `backlog` - Tasks in the backlog
2. `in_progress` - Tasks currently being worked on
3. `done` - Completed tasks
4. `abandoned` - Tasks that have been abandoned/cancelled

### 2. Board Columns (Stages)
**Location**: `/server/routes.ts` (lines 14-25)

The Kanban board displays **3 columns** based on stages created during initialization:
```typescript
const backlogStage = await storage.createStage({
  name: "Backlog",
  order: 1,
});
const inProgressStage = await storage.createStage({
  name: "In Progress",
  order: 2,
});
const doneStage = await storage.createStage({
  name: "Done",
  order: 3,
});
```

The board stages are:
1. **Backlog** (order: 1)
2. **In Progress** (order: 2)
3. **Done** (order: 3)

### 3. Task Status Selector in UI
**Locations**: 
- Create Task Dialog: `/client/src/components/CreateTaskDialog.tsx` (lines 192-238)
- Edit Task Dialog: `/client/src/components/EditTaskDialog.tsx` (lines 232-255)

#### Create Task Dialog
The Create Task Dialog **does NOT show a status selector** to users. The status is:
- Set as a hidden field with default value `"backlog"`
- Automatically inferred from the stage name when submitting (lines 75-86)
- Users only see: Title, Stage, Description, Priority, and Effort fields

#### Edit Task Dialog
The Edit Task Dialog **DOES show a status selector** with all 4 status values (lines 232-255):
```typescript
<FormField
  control={form.control}
  name="status"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Status</FormLabel>
      <Select onValueChange={field.onChange} value={field.value || "backlog"}>
        <SelectContent>
          <SelectItem value="backlog">Backlog</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
          <SelectItem value="abandoned">Abandoned</SelectItem>
        </SelectContent>
      </Select>
    </FormItem>
  )}
/>
```

## The Inconsistency

### Problem Statement
**The data model supports 4 task statuses (`backlog`, `in_progress`, `done`, `abandoned`), but the board only displays 3 columns (`Backlog`, `In Progress`, `Done`).**

### Specific Inconsistencies

1. **Missing Column for "Abandoned" Status**
   - The `abandoned` status exists in the data model and can be selected in the Edit Task Dialog
   - However, there is **no "Abandoned" column** on the Kanban board
   - Tasks marked as "abandoned" will be:
     - Assigned to one of the 3 existing stages based on their `stageId`
     - Display status as "abandoned" when viewed in the Edit Dialog
     - **Not visually distinguishable** from other tasks in the same column on the board

2. **Disconnect Between Status and Stage**
   - Tasks have both a `status` field (4 possible values) and a `stageId` field (references board columns)
   - These two concepts are **loosely coupled** through name-matching logic in `KanbanBoard.tsx` (lines 111-123):
     ```typescript
     const getStatusFromStageName = (stageName: string): "backlog" | "in_progress" | "done" | "abandoned" => {
       const name = stageName.toLowerCase();
       if (name.includes("progress") || name.includes("doing") || name.includes("active")) {
         return "in_progress";
       }
       if (name.includes("done") || name.includes("complete") || name.includes("finished")) {
         return "done";
       }
       if (name.includes("abandon") || name.includes("cancel")) {
         return "abandoned";
       }
       return "backlog";
     };
     ```
   - This function **can return "abandoned"** status, but there's no stage with a name containing "abandon" or "cancel"

3. **User Experience Confusion**
   - Users can set a task status to "abandoned" in the Edit Dialog
   - But they cannot see where "abandoned" tasks are displayed on the board
   - There's no dedicated visual representation for abandoned tasks unless the user opens the Edit Dialog

4. **No Visual Indicator for Task Status**
   - The `TaskCard` component (lines 1-174 in `/client/src/components/TaskCard.tsx`) displays:
     - Task title, description, priority, effort, due date, tags, and ID
     - **Does NOT display the task status** anywhere on the card
   - Users cannot distinguish task status (backlog vs in_progress vs done vs abandoned) by looking at the card
   - The only way to see task status is to open the Edit Dialog
   - This makes the status field effectively invisible in the main UI

5. **Semantic Mismatch**
   - "Stage" refers to the **column** on the board (workflow position)
   - "Status" refers to the **state** of the task (lifecycle state)
   - The board conflates these two concepts by using stages to represent status

## Impact

1. **Data Integrity**: Tasks can have status values that don't align with any visible board column
2. **User Confusion**: Users can select "abandoned" status but won't see it reflected on the board layout
3. **Incomplete Workflow**: The workflow supports abandoning tasks, but there's no visual representation for it
4. **Hidden Tasks**: Abandoned tasks are visually hidden among other tasks in their current stage
5. **Invisible Status Field**: The status field is not displayed on task cards, making it effectively invisible in the main board UI
6. **Dual Tracking Systems**: The application maintains two separate but related concepts (stage and status) that are meant to track workflow but are not properly synchronized or visualized

## Evidence Files

1. **Schema Definition**: `/shared/schema.ts` - Lines 25-27 (taskStatusEnum with 4 values)
2. **Board Initialization**: `/server/routes.ts` - Lines 14-25 (only 3 stages created)
3. **Edit Dialog UI**: `/client/src/components/EditTaskDialog.tsx` - Lines 232-255 (status selector with 4 options)
4. **Create Dialog UI**: `/client/src/components/CreateTaskDialog.tsx` - Lines 67-69 (no status selector visible to user)
5. **Board Rendering**: `/client/src/components/KanbanBoard.tsx` - Lines 111-123 (status inference logic)
6. **Task Card Component**: `/client/src/components/TaskCard.tsx` - Lines 1-174 (no status display on card)
7. **Storage Layer**: `/server/storage.ts` - Lines 80-116 (status handling in createTask)

## Conclusion

The investigation **confirms** the reported inconsistency. The data model defines 4 task statuses including "abandoned", while the UI board only displays 3 columns. The Edit Task Dialog exposes all 4 status values to users, creating a disconnect between what users can select and what they can visually see on the board.

The root cause is an **architectural mismatch** between:
- The data model (4 statuses: backlog, in_progress, done, abandoned)
- The UI board representation (3 stages: Backlog, In Progress, Done)
- The task editing interface (exposes all 4 statuses)

This creates a situation where users can assign a status value that has no corresponding visual column on the board.

---
**Report Date**: 2026-01-31  
**Investigated By**: Copilot  
**Status**: Investigation Complete - Issue Confirmed
