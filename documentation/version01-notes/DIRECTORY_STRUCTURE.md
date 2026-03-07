# kanban-local1 — Directory Structure

> Generated: 2026-03-07
> Excludes: `node_modules/`, `.git/`, `.history/`, `.next/`, `dist/`, `__pycache__/`, `.DS_Store`

```
kanban-local1/
├── .cursorignore
├── .devlaunch
├── .env
├── .gitignore
├── CHANGELOG.md
├── REASONLOG.md
├── components.json
├── docker-compose.yml
├── drizzle.config.ts
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
│
├── bugs/
│   └── archive-drag-drop-not-working.json
│
├── client/
│   ├── index.html
│   ├── requirements.md
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── vite-env.d.ts
│       ├── components/
│       │   ├── ArchiveZone.tsx
│       │   ├── ColorPicker.tsx
│       │   ├── CreateTaskDialog.tsx
│       │   ├── DayPlanSubStage.tsx
│       │   ├── EditTaskDialog.tsx
│       │   ├── FocusModeToggle.tsx
│       │   ├── InlineTaskEditor.tsx
│       │   ├── KanbanBoard.tsx
│       │   ├── StageHeaders.tsx
│       │   ├── TaskCard.tsx
│       │   ├── TaskCardSummary.tsx
│       │   ├── TaskColumn.tsx
│       │   ├── TaskHistoryModal.tsx
│       │   ├── TaskWarnings.tsx
│       │   └── ui/
│       │       ├── accordion.tsx
│       │       ├── alert.tsx
│       │       ├── alert-dialog.tsx
│       │       ├── aspect-ratio.tsx
│       │       ├── avatar.tsx
│       │       ├── badge.tsx
│       │       ├── breadcrumb.tsx
│       │       ├── button.tsx
│       │       ├── calendar.tsx
│       │       ├── card.tsx
│       │       ├── carousel.tsx
│       │       ├── chart.tsx
│       │       ├── checkbox.tsx
│       │       ├── collapsible.tsx
│       │       ├── command.tsx
│       │       ├── context-menu.tsx
│       │       ├── dialog.tsx
│       │       ├── drawer.tsx
│       │       ├── dropdown-menu.tsx
│       │       ├── form.tsx
│       │       ├── hover-card.tsx
│       │       ├── input.tsx
│       │       ├── input-otp.tsx
│       │       ├── label.tsx
│       │       ├── menubar.tsx
│       │       ├── navigation-menu.tsx
│       │       ├── pagination.tsx
│       │       ├── popover.tsx
│       │       ├── progress.tsx
│       │       ├── radio-group.tsx
│       │       ├── resizable.tsx
│       │       ├── scroll-area.tsx
│       │       ├── select.tsx
│       │       ├── separator.tsx
│       │       ├── sheet.tsx
│       │       ├── sidebar.tsx
│       │       ├── skeleton.tsx
│       │       ├── slider.tsx
│       │       ├── switch.tsx
│       │       ├── table.tsx
│       │       ├── tabs.tsx
│       │       ├── textarea.tsx
│       │       ├── toast.tsx
│       │       ├── toaster.tsx
│       │       ├── toggle.tsx
│       │       ├── toggle-group.tsx
│       │       └── tooltip.tsx
│       ├── hooks/
│       │   ├── use-keyboard-shortcuts.ts
│       │   ├── use-mobile.tsx
│       │   ├── use-tasks.ts
│       │   └── use-toast.ts
│       ├── lib/
│       │   ├── queryClient.ts
│       │   └── utils.ts
│       └── pages/
│           ├── Admin.tsx
│           ├── Archive.tsx
│           ├── Dashboard.tsx
│           └── not-found.tsx
│
├── development/
│   ├── 00-UIX/
│   │   ├── CNE (EPICS)/
│   │   └── CNI (ATOMICS)/
│   ├── 01-R2-REFACTOR/
│   │   ├── CNE (EPICS)/
│   │   │   └── r2-codebase-refactor.json
│   │   └── CNI (ATOMICS)/
│   └── templates/
│       ├── 00_CNE/
│       │   ├── cne-epic-schema.json
│       │   └── cne-epic-template.json
│       └── 01_CNI/
│           ├── cni-atomic-schema.json
│           └── cni-template.json
│
├── documentation/
│   └── version01-notes/
│       ├── .env.example
│       ├── API_REFERENCE.md
│       ├── ARCHITECTURE.md
│       ├── COMMIT_MESSAGE.txt
│       ├── COMPONENT_INDEX.md
│       ├── DATA_FLOW.md
│       ├── DEBUG_FIXES.md
│       ├── DEVELOPMENT.md
│       ├── ENHANCEMENT_SUMMARY.md
│       ├── GENERATE_DEVLAUNCH.md
│       ├── INVESTIGATION-REPORT.md
│       ├── readme-instructions.md
│       ├── README-LAN-SETUP.md
│       ├── README-SETUP.md
│       ├── RELEASE-DRAFT.md
│       ├── setup.sh
│       ├── TASK_STATUS_INVESTIGATION_REPORT.md
│       └── UI_UX_DESIGN.md
│
├── migrations/
│   ├── 0000_hot_firebrand.sql
│   ├── 0001_add_color_to_stages.sql
│   └── meta/
│       ├── _journal.json
│       └── 0000_snapshot.json
│
├── script/
│   └── build.ts
│
├── scripts/
│   ├── README.md
│   ├── add-color-column.ts
│   ├── add-enhanced-task-fields.ts
│   ├── add-sub-stages-table.ts
│   └── reproduce-task-update-crash.ts
│
├── server/
│   ├── db.ts
│   ├── index.ts
│   ├── routes.ts
│   ├── static.ts
│   ├── storage.ts
│   └── vite.ts
│
└── shared/
    ├── routes.ts
    └── schema.ts
```
