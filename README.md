# Angular Asynchronous Test Specification

This workspace defines a test specification [async.spec.ts](src/async.spec.ts) which tests various asynchronous test scenarios common to Angular including handling micro and macrotasks with [fakeAsync](https://angular.io/api/core/testing/fakeAsync) and [ComponentFixture.whenStable](https://angular.io/api/core/testing/ComponentFixture#whenStable), asynchronous RxJS functions and operators, and update behaviors of the Nimble Design System and the underlying [@microsoft/fast-foundation](https://github.com/microsoft/fast/tree/master/packages/web-components/fast-foundation) components.

## Usage

- See [async.spec.ts](src/async.spec.ts).
- Run `npm test` to run and watch the tests.
- Run `npm test:ci` to run the tests once.

## Notes

The following are notes derived from these tests.

### Micro and Macrotasks

- `tick` and `flush` call Zone.js's [FakeAsyncTestZoneSpec](https://github.com/angular/angular/blob/67f0cf5fc8a2be4a48c6cd15db53ce9c9c4cd014/packages/core/testing/src/fake_async.ts#L127).
- `tick` has a [default tick count of 0](https://github.com/angular/angular/blob/67f0cf5fc8a2be4a48c6cd15db53ce9c9c4cd014/packages/core/testing/src/fake_async.ts#L122), defined by Angular in milliseconds.
- `flush` has a [default turn count of 20](https://github.com/angular/angular/blob/67f0cf5fc8a2be4a48c6cd15db53ce9c9c4cd014/packages/core/testing/src/fake_async.ts#L143), defined by the Zone.js fake async test scheduler.
- `tick` and `flush` [flush all microtasks first](https://github.com/angular/zone.js/blob/b11bd466c20dc338b6d4d5bc3e59868ff263778d/lib/zone-spec/fake-async-test.ts#L400), e.g. `Promise.then` and `queueMicrotask`.
- `tick` executes macrotasks, including periodic tasks (timers) like `setInterval`, [scheduled up to the current time plus the tick count](https://github.com/angular/zone.js/blob/b11bd466c20dc338b6d4d5bc3e59868ff263778d/lib/zone-spec/fake-async-test.ts#L135).
  - Therefore, by default `tick` only executes the tasks scheduled up to but not at the current time.
- `flush` executes macrotasks, but not periodic tasks (timers), [up to the turn count number of tasks (which is treated as the limit) or the first periodic task](https://github.com/angular/zone.js/blob/b11bd466c20dc338b6d4d5bc3e59868ff263778d/lib/zone-spec/fake-async-test.ts#L187).
  - Therefore, by default `flush` executes a maximum of 20 non-periodic macrotasks.
  - If there are more than the limit number of tasks, `flush` throws an error.

### RxJS

- Asynchronous RxJS functions and operators, e.g. `timer`, `delay`, `debounceTime`, commonly use the `AsyncScheduler` which
  schedules periodic tasks with `setInterval`.
- `flush` does not work with the `AsyncScheduler`. Therefore, `tick` or `ComponentFixture.whenStable` are commonly required for
  tests involving asynchronous RxJS operations.
- Some of these functions accept a scheduler parameter that will override the default. However, schedulers like the
  `AnimationFrameScheduler` fallback to the `AsyncScheduler` for RxJS operations that require a timer.

### Nimble Design System

- `fakeAsync` may not work with even simple asynchronous Nimble updates like button appearance.
- `ComponentFixture.whenStable` will commonly execute Nimble updates without issue, but `waitForUpdatesAsync` will not execute non-Nimble tasks.
- Nimble can [leak tasks between fakeAsync tests](https://github.com/ni/nimble/blob/main/angular-workspace/projects/ni/nimble-angular/README.md#testing-with-nimble-elements-and-fakeasync) causing test failures due to pending queued tasks.
- Nimble's `waitForUpdatesAsync` has two common issues.
  - In watch mode, `waitForUpdatesAsync` may timeout after a change and compile. Refresh the page to rerun the test.
  - non-fakeAsync tests can leak tasks that break calls to `waitForUpdatesAsync` for all subsequent tests.
- There have been a few reports `ComponentFixture.whenStable` did not work and `waitForUpdatesAsync` was required in some obscure cases. However, the exact reason is not known.
