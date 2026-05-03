// Plantillas de proyectos pre-armadas que el usuario puede crear con
// un click. Cada template define:
//   - meta: name, emoji, color, description
//   - tasks: lista de tareas que se crean dentro del proyecto
//
// Cuando se aplica una plantilla:
//   1. POST /api/projects con la meta → recibe project.id
//   2. Por cada task del template, POST /api/tasks con project_id=id
//      (assigned_to / assigned_by se setea desde el usuario actual)
//   3. Refetch projects + showToast confirmando

export const PROJECT_TEMPLATES = [
  {
    id: 'shopping',
    name: 'Lista de compras',
    emoji: '🛒',
    color: '#22c55e',
    description: 'Lo que necesitamos del super',
    tasks: [
      { title: 'Frutas y verduras', priority: 'medium' },
      { title: 'Lacteos', priority: 'medium' },
      { title: 'Carne / pescado', priority: 'medium' },
      { title: 'Pan / cereales', priority: 'low' },
      { title: 'Productos de limpieza', priority: 'low' },
      { title: 'Articulos de aseo personal', priority: 'low' },
    ],
  },
  {
    id: 'trip',
    name: 'Plan de viaje',
    emoji: '✈️',
    color: '#06b6d4',
    description: 'Preparativos para nuestro viaje',
    tasks: [
      { title: 'Reservar vuelos', priority: 'high' },
      { title: 'Reservar hospedaje', priority: 'high' },
      { title: 'Sacar/renovar pasaportes', priority: 'high' },
      { title: 'Comprar seguro de viaje', priority: 'medium' },
      { title: 'Hacer maletas', priority: 'medium' },
      { title: 'Organizar transporte al aeropuerto', priority: 'medium' },
      { title: 'Cambiar moneda local', priority: 'low' },
      { title: 'Avisar al banco del viaje', priority: 'low' },
    ],
  },
  {
    id: 'move',
    name: 'Mudanza',
    emoji: '🏠',
    color: '#f97316',
    description: 'Todo lo que hay que hacer al mudarse',
    tasks: [
      { title: 'Cotizar empresas de mudanza', priority: 'high' },
      { title: 'Empacar habitacion principal', priority: 'high' },
      { title: 'Empacar cocina', priority: 'high' },
      { title: 'Cambiar direccion en servicios (luz, agua, gas)', priority: 'high' },
      { title: 'Notificar nueva direccion al banco', priority: 'medium' },
      { title: 'Programar limpieza profunda casa anterior', priority: 'medium' },
      { title: 'Comprar cajas y burbujas', priority: 'medium' },
      { title: 'Despedirse de los vecinos', priority: 'low' },
    ],
  },
  {
    id: 'event',
    name: 'Organizar evento',
    emoji: '🎉',
    color: '#ec4899',
    description: 'Cumpleaños, aniversario o reunion',
    tasks: [
      { title: 'Definir fecha y lugar', priority: 'high' },
      { title: 'Lista de invitados', priority: 'high' },
      { title: 'Enviar invitaciones', priority: 'medium' },
      { title: 'Menu / catering', priority: 'medium' },
      { title: 'Decoracion', priority: 'medium' },
      { title: 'Musica / playlist', priority: 'low' },
      { title: 'Confirmar asistencias', priority: 'low' },
    ],
  },
  {
    id: 'wellness',
    name: 'Rutina semanal en pareja',
    emoji: '💪',
    color: '#8b5cf6',
    description: 'Habitos que queremos sostener juntos',
    tasks: [
      { title: 'Caminata o ejercicio', priority: 'medium', recurrence: 'custom', recurrence_days: '[1,3,5]' },
      { title: 'Cocinar juntos', priority: 'medium', recurrence: 'weekly' },
      { title: 'Date night', priority: 'high', recurrence: 'weekly' },
      { title: 'Llamar a la familia', priority: 'low', recurrence: 'weekly' },
      { title: 'Planificar la semana', priority: 'medium', recurrence: 'weekly' },
    ],
  },
];
