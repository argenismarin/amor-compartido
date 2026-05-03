// Helper para mockear las API routes desde Playwright.
//
// Cada test puede llamar a `setupApiMocks(page, initialState?)` antes del
// page.goto() para interceptar todas las llamadas a /api/*. El state es
// mutable: POST/PUT/DELETE actualizan el objeto y los siguientes GETs
// devuelven la versión actualizada — comportamiento end-to-end real
// sin tocar BD.
//
// Uso típico:
//   const state = await setupApiMocks(page);
//   await page.goto('/');
//   // ... interactuar con la UI ...
//   expect(state.tasks.length).toBe(1); // verificar mutaciones

const DEFAULT_USERS = [
  { id: 1, name: 'Jenifer', avatar_emoji: '💕' },
  { id: 2, name: 'Argenis', avatar_emoji: '🍷' },
];

const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Casa', emoji: '🏠', color: '#4CAF50' },
  { id: 2, name: 'Compras', emoji: '🛒', color: '#2196F3' },
  { id: 3, name: 'Salud', emoji: '💪', color: '#E91E63' },
  { id: 4, name: 'Juntos', emoji: '💑', color: '#9C27B0' },
  { id: 5, name: 'Trabajo', emoji: '💼', color: '#FF9800' },
  { id: 6, name: 'Otros', emoji: '📌', color: '#607D8B' },
];

function makeInitialState(overrides = {}) {
  return {
    users: DEFAULT_USERS,
    categories: DEFAULT_CATEGORIES,
    projects: [],
    archivedProjects: [],
    tasks: [],
    streak: { current_streak: 0, best_streak: 0 },
    achievements: [],
    specialDates: [],
    history: { tasks: [], stats: { thisWeek: 0, total: 0 } },
    nextTaskId: 1,
    nextSubtaskId: 1,
    ...overrides,
  };
}

// Devuelve un task con metadata enriquecida (los names que el GET devolvería)
function enrichTask(task, state) {
  const assignedTo = state.users.find(u => u.id === task.assigned_to);
  const assignedBy = state.users.find(u => u.id === task.assigned_by);
  const category = task.category_id
    ? state.categories.find(c => c.id === task.category_id)
    : null;
  const project = task.project_id
    ? state.projects.find(p => p.id === task.project_id)
    : null;

  return {
    ...task,
    assigned_to_name: assignedTo?.name,
    assigned_to_avatar: assignedTo?.avatar_emoji,
    assigned_by_name: assignedBy?.name,
    assigned_by_avatar: assignedBy?.avatar_emoji,
    category_name: category?.name || null,
    category_emoji: category?.emoji || null,
    category_color: category?.color || null,
    project_name: project?.name || null,
    project_emoji: project?.emoji || null,
    project_color: project?.color || null,
    subtasks: task.subtasks || [],
  };
}

export async function setupApiMocks(page, overrides = {}) {
  const state = makeInitialState(overrides);

  // GET /api/users
  await page.route('**/api/users', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: state.users });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });

  // GET /api/categories
  await page.route('**/api/categories', async (route) => {
    await route.fulfill({ json: state.categories });
  });

  // GET /api/projects (con o sin includeArchived)
  await page.route('**/api/projects?**', async (route) => {
    const url = new URL(route.request().url());
    const includeArchived = url.searchParams.get('includeArchived') === 'true';
    const list = includeArchived
      ? [...state.projects, ...state.archivedProjects]
      : state.projects;
    await route.fulfill({ json: list });
  });
  await page.route('**/api/projects', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: state.projects });
    } else if (route.request().method() === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      const newProject = {
        id: state.projects.length + 100,
        ...body,
        is_archived: false,
        total_tasks: 0,
        completed_tasks: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.projects.push(newProject);
      await route.fulfill({ json: { success: true, id: newProject.id } });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });

  // PUT/DELETE /api/projects/[id] (con o sin ?permanent=true)
  await page.route(/\/api\/projects\/\d+(\?.*)?$/, async (route) => {
    const url = route.request().url();
    const idMatch = url.match(/\/api\/projects\/(\d+)/);
    const id = idMatch ? parseInt(idMatch[1]) : 0;
    const isPermanent = new URL(url).searchParams.get('permanent') === 'true';

    // Buscar en activos y archivados
    let project = state.projects.find(p => p.id === id)
                || state.archivedProjects.find(p => p.id === id);
    if (!project) {
      await route.fulfill({ status: 404, json: { error: 'not found' } });
      return;
    }

    const method = route.request().method();
    if (method === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.is_archived === true) {
        // archivar: mover de activos a archivados
        state.projects = state.projects.filter(p => p.id !== id);
        if (!state.archivedProjects.some(p => p.id === id)) {
          state.archivedProjects.push({ ...project, is_archived: true });
        }
      } else if (body.is_archived === false) {
        // restaurar: mover de archivados a activos
        state.archivedProjects = state.archivedProjects.filter(p => p.id !== id);
        if (!state.projects.some(p => p.id === id)) {
          state.projects.push({ ...project, is_archived: false });
        }
      } else {
        Object.assign(project, body);
        project.updated_at = new Date().toISOString();
      }
      await route.fulfill({ json: { success: true } });
    } else if (method === 'DELETE') {
      if (isPermanent) {
        // borrar de archived + tasks asociadas
        state.archivedProjects = state.archivedProjects.filter(p => p.id !== id);
        state.projects = state.projects.filter(p => p.id !== id);
        state.tasks = state.tasks.filter(t => t.project_id !== id);
      } else {
        // soft archive (mismo que PUT is_archived: true)
        state.projects = state.projects.filter(p => p.id !== id);
        if (!state.archivedProjects.some(p => p.id === id)) {
          state.archivedProjects.push({ ...project, is_archived: true });
        }
      }
      await route.fulfill({ json: { success: true } });
    }
  });

  // GET /api/streaks?userId=
  await page.route('**/api/streaks?**', async (route) => {
    await route.fulfill({ json: state.streak });
  });

  // GET/POST /api/achievements
  await page.route('**/api/achievements?**', async (route) => {
    await route.fulfill({ json: state.achievements });
  });
  await page.route('**/api/achievements', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { newAchievements: [] } });
    } else {
      await route.fulfill({ json: state.achievements });
    }
  });

  // GET/POST /api/special-dates
  await page.route('**/api/special-dates**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: { dates: state.specialDates, mesiversarioInfo: null },
      });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });

  // GET /api/history
  await page.route('**/api/history?**', async (route) => {
    await route.fulfill({ json: state.history });
  });

  // GET /api/subscribe?publicKey=true → devolver una key fake para que
  // el flow de notificaciones no rompa los tests
  await page.route('**/api/subscribe?**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('publicKey') === 'true') {
      await route.fulfill({ json: { publicKey: null } });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  await page.route('**/api/subscribe', async (route) => {
    await route.fulfill({ json: { success: true } });
  });

  // GET/POST /api/tasks
  await page.route('**/api/tasks?**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    const userId = parseInt(url.searchParams.get('userId') || '0');
    const filter = url.searchParams.get('filter');
    const projectId = url.searchParams.get('projectId');
    const excludeProjectTasks = url.searchParams.get('excludeProjectTasks') === 'true';

    let result = state.tasks.filter(t => !t.deleted_at);

    if (filter === 'myTasks' && userId) {
      result = result.filter(t => t.assigned_to === userId || t.is_shared);
    } else if (filter === 'assignedByOther' && userId) {
      result = result.filter(t =>
        (t.assigned_to === userId && t.assigned_by !== userId) ||
        (t.is_shared && t.assigned_by !== userId)
      );
    } else if (filter === 'assignedToOther' && userId) {
      result = result.filter(t =>
        t.assigned_by === userId && t.assigned_to !== userId && !t.is_shared
      );
    }

    if (projectId === 'null') {
      result = result.filter(t => !t.project_id);
    } else if (projectId) {
      result = result.filter(t => t.project_id === parseInt(projectId));
    }

    if (excludeProjectTasks) {
      result = result.filter(t => !t.project_id);
    }

    // Mantener orden: incompletas primero, luego prioridad, luego created_at desc
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    result.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return String(b.created_at).localeCompare(String(a.created_at));
    });

    await route.fulfill({ json: result.map(t => enrichTask(t, state)) });
  });

  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    const newTask = {
      id: state.nextTaskId++,
      ...body,
      is_completed: false,
      completed_at: null,
      reaction: null,
      deleted_at: null,
      subtasks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.tasks.push(newTask);
    await route.fulfill({ json: { success: true, id: newTask.id } });
  });

  // PUT/DELETE /api/tasks/[id]
  await page.route(/\/api\/tasks\/\d+$/, async (route) => {
    const url = route.request().url();
    const idMatch = url.match(/\/api\/tasks\/(\d+)$/);
    const id = idMatch ? parseInt(idMatch[1]) : 0;
    const task = state.tasks.find(t => t.id === id);

    if (!task) {
      await route.fulfill({ status: 404, json: { error: 'not found' } });
      return;
    }

    const method = route.request().method();
    if (method === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.toggle_complete) {
        task.is_completed = !task.is_completed;
        task.completed_at = task.is_completed ? new Date().toISOString() : null;
        await route.fulfill({ json: { success: true, completed: task.is_completed } });
      } else if (body.reaction !== undefined) {
        task.reaction = body.reaction;
        await route.fulfill({ json: { success: true } });
      } else {
        Object.assign(task, body);
        task.updated_at = new Date().toISOString();
        await route.fulfill({ json: { success: true } });
      }
    } else if (method === 'DELETE') {
      task.deleted_at = new Date().toISOString();
      await route.fulfill({ json: { success: true } });
    }
  });

  // POST /api/tasks/[id]/restore
  await page.route(/\/api\/tasks\/\d+\/restore$/, async (route) => {
    const idMatch = route.request().url().match(/\/api\/tasks\/(\d+)\/restore$/);
    const id = idMatch ? parseInt(idMatch[1]) : 0;
    const task = state.tasks.find(t => t.id === id);
    if (task) task.deleted_at = null;
    await route.fulfill({ json: { success: true } });
  });

  // POST /api/subtasks
  await page.route('**/api/subtasks', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const body = JSON.parse(route.request().postData() || '{}');
    const task = state.tasks.find(t => t.id === body.task_id);
    if (!task) {
      await route.fulfill({ status: 404, json: { error: 'task not found' } });
      return;
    }
    const newSub = {
      id: state.nextSubtaskId++,
      task_id: body.task_id,
      title: body.title,
      is_completed: false,
      sort_order: (task.subtasks?.length || 0) + 1,
    };
    task.subtasks = [...(task.subtasks || []), newSub];
    await route.fulfill({ json: { success: true, subtask: newSub } });
  });

  // PUT/DELETE /api/subtasks/[id]
  await page.route(/\/api\/subtasks\/\d+$/, async (route) => {
    const idMatch = route.request().url().match(/\/api\/subtasks\/(\d+)$/);
    const id = idMatch ? parseInt(idMatch[1]) : 0;

    let foundSub = null;
    let foundTask = null;
    for (const task of state.tasks) {
      const sub = (task.subtasks || []).find(s => s.id === id);
      if (sub) {
        foundSub = sub;
        foundTask = task;
        break;
      }
    }

    if (!foundSub) {
      await route.fulfill({ status: 404, json: { error: 'not found' } });
      return;
    }

    const method = route.request().method();
    if (method === 'PUT') {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.toggle_complete) {
        foundSub.is_completed = !foundSub.is_completed;
      } else if (body.title) {
        foundSub.title = body.title;
      }
      await route.fulfill({ json: { success: true } });
    } else if (method === 'DELETE') {
      foundTask.subtasks = foundTask.subtasks.filter(s => s.id !== id);
      await route.fulfill({ json: { success: true } });
    }
  });

  return state;
}
