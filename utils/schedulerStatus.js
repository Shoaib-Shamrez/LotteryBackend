// utils/schedulerStatus.js
//
// Singleton holder for the scheduler controller returned by startScheduler().
// The scheduler is started in server.js. We store the controller here so that
// the sync health / scheduler-status endpoints can query its status() without
// creating a circular import (scheduler.js -> server.js -> scheduler.js).
//
// This module holds NO scheduler logic — it only stores a reference to the
// controller returned by startScheduler() and exposes a safe read function.
// The scheduler itself is NOT duplicated, NOT re-created, and NOT reconfigured.

let _controller = null;

export function setSchedulerController(controller) {
  _controller = controller;
}

export function clearSchedulerController() {
  _controller = null;
}

/**
 * Returns the scheduler status in a stable shape.
 *
 * Definitions:
 * - started: true if the cron is registered (scheduler initialization completed).
 * - running: true if a tick is currently executing.
 * - active:  started && !running — the scheduler is registered AND idle (ready
 *            to fire on the next cron tick; NOT currently blocked by an in-flight run).
 * - initialized: true if a controller has been registered.
 *
 * When the scheduler has not been initialized (e.g. test mode, or DB not
 * ready yet), returns a safe inactive state rather than throwing.
 */
export function getSchedulerStatus() {
  if (!_controller) {
    return {
      started: false,
      running: false,
      active: false,
      initialized: false,
      cron: null,
      categories: [],
      lastError: null
    };
  }

  let status;
  try {
    status = _controller.status();
  } catch {
    return {
      started: false,
      running: false,
      active: false,
      initialized: true,
      cron: null,
      categories: [],
      lastError: "Scheduler controller status unavailable"
    };
  }

  const started = !!status.started;
  const running = !!status.running;

  return {
    started,
    running,
    active: started && !running,
    initialized: true,
    cron: status.cron || null,
    categories: Array.isArray(status.categories) ? status.categories : [],
    lastError: status.lastError || null
  };
}
