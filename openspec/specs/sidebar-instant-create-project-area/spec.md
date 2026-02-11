# sidebar-instant-create-project-area Specification

## Purpose
TBD - created by archiving change sidebar-instant-create-empty-title. Update Purpose after archive.
## Requirements
### Requirement: Sidebar can create a Project without a pre-entered title
The system SHALL allow the user to create a Project from the Sidebar without entering a title first.

#### Scenario: Create Project from Sidebar navigates to the new project
- **WHEN** the user activates the Sidebar `+ New` control
- **AND WHEN** the user chooses `Project`
- **THEN** the system SHALL create a new Project with `title=''`
- **AND THEN** the app SHALL navigate to `/projects/:projectId` for the newly created Project

### Requirement: Sidebar can create an Area without a pre-entered title
The system SHALL allow the user to create an Area from the Sidebar without entering a title first.

#### Scenario: Create Area from Sidebar navigates to the new area
- **WHEN** the user activates the Sidebar `+ New` control
- **AND WHEN** the user chooses `Area`
- **THEN** the system SHALL create a new Area with `title=''`
- **AND THEN** the app SHALL navigate to `/areas/:areaId` for the newly created Area

### Requirement: Post-create navigation enters title editing and focuses the title input
After creating a Project or Area from the Sidebar and navigating to its page, the system SHALL immediately enter inline title editing and focus the title input.

#### Scenario: New Project enters title edit with focus
- **WHEN** the user creates a Project from the Sidebar
- **AND WHEN** the app navigates to `/projects/:projectId`
- **THEN** the Project page SHALL enter title edit mode
- **AND THEN** the title input SHALL receive keyboard focus

#### Scenario: New Area enters title edit with focus
- **WHEN** the user creates an Area from the Sidebar
- **AND WHEN** the app navigates to `/areas/:areaId`
- **THEN** the Area page SHALL enter title edit mode
- **AND THEN** the title input SHALL receive keyboard focus

### Requirement: Title-edit trigger is one-time per navigation
The mechanism used to enter title edit mode after Sidebar creation SHALL only trigger once and SHALL NOT repeatedly re-enter edit mode on refresh or back navigation.

#### Scenario: Edit trigger does not re-run after it is consumed
- **WHEN** the user creates a Project or Area from the Sidebar
- **AND WHEN** the app enters title edit mode due to the post-create trigger
- **THEN** subsequent renders of the same page state SHALL NOT automatically re-enter title edit mode unless the user explicitly triggers rename

