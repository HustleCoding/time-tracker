# Time Tracking Desktop App - MVP Plan

## Project Overview

A desktop time tracking application built with Tauri that allows users to track time spent on different projects/tasks with local data persistence.

## Tech Stack

- **Framework**: Tauri (latest stable version)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust
- **Database**: SQLite via tauri-plugin-sql
- **Platform Support**: macOS, Windows, Linux

---

## MVP Features

### 1. Timer Controls

**Description**: Core time tracking functionality

**Components**:

- Start/Stop button for time tracking
- Input field for project/task name
- Real-time timer display (HH:MM:SS format)
- Visual indicator when timer is running

**Technical Requirements**:

- Timer state management (React state or Context)
- Accurate time calculation
- Prevent multiple timers running simultaneously
- Auto-save on timer stop

---

### 2. Time Entries List

**Description**: Display and manage tracked time entries

**Components**:

- List view showing all entries for today
- Each entry displays:
  - Project/task name
  - Duration (formatted)
  - Start time
  - End time
- Edit button to modify project name
- Delete button to remove entry
- Entries sorted by start time (newest first)

**Technical Requirements**:

- Real-time updates when timer stops
- Inline editing for project names
- Confirmation dialog for delete actions
- Efficient rendering for multiple entries

---

### 3. Data Persistence

**Description**: Local database storage for all time entries

**Database Schema**:

```sql
CREATE TABLE time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    start_time INTEGER NOT NULL,  -- Unix timestamp
    end_time INTEGER NOT NULL,    -- Unix timestamp
    duration INTEGER NOT NULL     -- Duration in seconds
);
```

**Technical Requirements**:

- Initialize database on first app launch
- CRUD operations via Tauri commands
- Proper error handling
- Data persists between app restarts
- Transaction support for data integrity

---

### 4. System Tray Integration

**Description**: System tray icon for quick access

**Features**:

- App icon visible in system tray
- Right-click context menu:
  - "Show/Hide Window" - Toggle main window visibility
  - "Quit" - Exit application
- Click tray icon to show/hide window
- Visual indicator when timer is running (optional: different icon)

**Technical Requirements**:

- Use tray-icon crate
- Handle window show/hide events
- Proper cleanup on app exit
- Platform-specific icon formats

---

### 5. Basic UI

**Description**: Clean, minimal, and functional interface

**Design Requirements**:

- Today's total time displayed prominently at top
- Clear visual hierarchy
- Responsive layout (adapts to window resize)
- Consistent spacing and typography
- Loading states for async operations
- Error messages for user feedback

**Color Scheme** (suggested):

- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Danger: Red (#EF4444)
- Neutral: Gray scale

---

## Implementation Steps

### Phase 1: Project Setup ✅

- [x] Initialize Tauri project
- [x] Configure dependencies
- [x] Fix Rust/Cargo setup issues
- [x] Verify dev environment works

### Phase 2: Database Setup

- [ ] Install and configure tauri-plugin-sql
- [ ] Create database initialization code
- [ ] Write database migration script
- [ ] Create Rust functions for CRUD operations
- [ ] Test database operations

### Phase 3: Backend (Rust Commands)

- [ ] `start_timer` - Create new entry with start time
- [ ] `stop_timer` - Update entry with end time and duration
- [ ] `get_today_entries` - Fetch all entries for current day
- [ ] `update_entry` - Update project name
- [ ] `delete_entry` - Remove entry from database
- [ ] `get_today_total` - Calculate total time for today

### Phase 4: Frontend Components

- [ ] Create Timer component
  - Start/Stop button
  - Project name input
  - Running timer display
- [ ] Create TimeEntry component
  - Display entry details
  - Edit functionality
  - Delete functionality
- [ ] Create TimeEntriesList component
  - Map over entries
  - Handle empty state
- [ ] Create TodayTotal component
  - Display formatted total time
  - Auto-update when entries change

### Phase 5: State Management

- [ ] Set up React Context for global state
- [ ] Manage timer state (running/stopped)
- [ ] Manage entries list
- [ ] Handle loading states
- [ ] Implement error handling

### Phase 6: System Tray

- [ ] Add tray-icon dependency
- [ ] Create tray icon assets (PNG, ICO)
- [ ] Implement tray menu
- [ ] Handle show/hide window
- [ ] Handle quit action

### Phase 7: Styling & Polish

- [ ] Apply Tailwind CSS styles
- [ ] Ensure responsive layout
- [ ] Add transitions/animations
- [ ] Implement loading spinners
- [ ] Style buttons and inputs
- [ ] Add hover states

### Phase 8: Testing & Debugging

- [ ] Test timer accuracy
- [ ] Test database operations
- [ ] Test system tray functionality
- [ ] Test on different window sizes
- [ ] Fix any bugs found
- [ ] Test app restart (data persistence)

### Phase 9: Build & Distribution

- [ ] Test production build
- [ ] Verify on macOS
- [ ] Verify on Windows (if available)
- [ ] Verify on Linux (if available)
- [ ] Document known issues

---

## MVP Success Criteria

### Functional Requirements

- ✅ App runs without crashes on target platforms
- ✅ Can start and stop timer accurately
- ✅ Can track multiple tasks in a day
- ✅ Data persists between app restarts
- ✅ Can edit project names
- ✅ Can delete entries
- ✅ System tray icon appears and works correctly
- ✅ Today's total time calculates correctly

### Performance Requirements

- App launches in < 3 seconds
- Timer updates display every second
- Database operations complete in < 100ms
- UI remains responsive during operations

### User Experience Requirements

- Clear visual feedback for all actions
- No confusing error states
- Intuitive controls
- Professional appearance

---

## Out of Scope for MVP

The following features are **NOT** included in the MVP and should be considered for future versions:

### Reporting & Analytics

- Weekly/monthly reports
- Charts and graphs
- Time trends analysis
- Project statistics

### Invoice Generation

- PDF invoice creation
- Invoice templates
- Client management
- Billing rates

### Multiple Days View

- Calendar view
- Date range selection
- Historical data browsing
- Search functionality

### Export Functionality

- CSV export
- JSON export
- PDF reports
- Integration with other tools

### User Settings/Preferences

- Customizable themes
- Keyboard shortcuts
- Notification preferences
- Time format options
- Currency settings

### Advanced Features

- Tags for entries
- Project categories
- Break time tracking
- Pomodoro timer
- Cloud sync
- Multi-user support
- Mobile app companion

---

## Technical Notes

### Time Handling

- Store all times as Unix timestamps (UTC)
- Display times in user's local timezone
- Use consistent time library (chrono in Rust, date-fns in React)

### Data Validation

- Project name: min 1 char, max 255 chars
- Duration: must be positive
- Start time: cannot be in future
- End time: must be after start time

### Error Handling

- Database errors: show user-friendly message
- Invalid input: show validation error
- Network issues: N/A (fully local app)

### Security Considerations

- No sensitive data in MVP
- Local-only storage
- No network requests

---

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow Rust best practices
- Consistent naming conventions
- Comment complex logic
- Keep functions small and focused

### Git Workflow

- Commit frequently with clear messages
- Use feature branches for major changes
- Keep main branch stable

### Testing Strategy

- Manual testing for MVP
- Test all CRUD operations
- Test edge cases (empty states, long names, etc.)
- Test on multiple platforms if possible

---

## Timeline Estimate

**Total Estimated Time**: 20-30 hours

- Phase 2 (Database): 2-3 hours
- Phase 3 (Backend): 4-5 hours
- Phase 4 (Frontend): 6-8 hours
- Phase 5 (State Management): 2-3 hours
- Phase 6 (System Tray): 2-3 hours
- Phase 7 (Styling): 3-4 hours
- Phase 8 (Testing): 2-3 hours
- Phase 9 (Build): 1-2 hours

_Note: Times are estimates and may vary based on experience level and unforeseen issues._

---

## Next Steps

1. Review this plan and confirm approach
2. Begin Phase 2: Database Setup
3. Install tauri-plugin-sql
4. Create database schema and initialization code

---

**Last Updated**: 2025-11-06
**Status**: Ready to begin Phase 2
