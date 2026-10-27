import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** A textarea that grows with its content, used for every editable text area. */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoTextarea(props, ref) {
    const inner = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => inner.current!);

    useLayoutEffect(() => {
      const el = inner.current;
      if (!el) return;
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;
    });

    useLayoutEffect(() => {
      const el = inner.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        el.style.height = '0px';
        el.style.height = `${el.scrollHeight}px`;
      });
      ro.observe(el.parentElement ?? el);
      return () => ro.disconnect();
    }, []);

    return <textarea rows={1} spellCheck {...props} ref={inner} />;
  },
);
