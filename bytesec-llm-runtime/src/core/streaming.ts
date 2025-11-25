import EventEmitter from "eventemitter3";
import type { StreamEvent, StreamEventType, StreamObserver } from "../types/events";

export type StreamEmitter = EventEmitter<StreamEventType>;

const eventTypes: ReadonlyArray<StreamEventType> = [
  "text",
  "tool_call",
  "tool_result",
  "error",
  "done",
];

export const createStreamEmitter = (): StreamEmitter => new EventEmitter<StreamEventType>();

export const emitStreamEvent = (emitter: StreamEmitter, event: StreamEvent) => {
  emitter.emit(event.type, event);
};

export const subscribeStream = (emitter: StreamEmitter, observer: StreamObserver) => {
  const handler = (event: StreamEvent) => observer(event);
  for (const type of eventTypes) {
    emitter.on(type, handler);
  }
  const unsubscribe = () => {
    for (const type of eventTypes) {
      emitter.off(type, handler);
    }
  };
  return unsubscribe;
};
