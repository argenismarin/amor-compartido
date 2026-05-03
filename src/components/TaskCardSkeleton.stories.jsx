import TaskCardSkeleton from './TaskCardSkeleton';

export default {
  title: 'Components/TaskCardSkeleton',
  component: TaskCardSkeleton,
};

export const Default = {};

export const Multiple = {
  render: () => (
    <div className="task-list">
      <TaskCardSkeleton />
      <TaskCardSkeleton />
      <TaskCardSkeleton />
    </div>
  ),
};
