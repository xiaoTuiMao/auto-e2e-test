import React, { useState } from 'react';
import style from './style.module.css';

const Page = (): React.ReactElement => {
  const [todoList, setTodoList] = useState<string[]>([]);
  const [todo, setTodo] = useState<string>('');
  return (
    <div>
      <div className={style.actionBox}>
        <input
          value={todo}
          onChange={(e): void => {
            setTodo(e.target.value);
          }}
        />
        <div
          onClick={() => {
            setTodoList([...todoList, todo]);
            setTodo('');
          }}
        >
          add
        </div>
      </div>
      <ul className={style.todoListBox}>
        {todoList.map((item, index) => (
          <li key={item}>
            <p>{item}</p>
            <div
              onClick={() => {
                todoList.splice(index, 1);
                setTodoList([...todoList]);
              }}
            >
              del
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Page;
