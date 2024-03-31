import { Component, ElementRef, NgZone } from '@angular/core';
import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick, waitForAsync } from '@angular/core/testing';
import { Button, ButtonAppearance, Menu, MenuItem, NimbleButtonModule, NimbleMenuButtonModule, NimbleMenuItemModule, NimbleMenuModule, NimbleTextFieldModule, NimbleThemeProviderModule, TextField, processUpdates, waitForUpdatesAsync } from '@ni/nimble-angular';
import { Observable, animationFrameScheduler, debounceTime, delay, timer } from 'rxjs';
import 'zone.js';

declare var Zone: ZoneType;

/**
 * This test specification has tests that include components from the Nimble Design System. Those tests that do not
 * involve Nimble, e.g. native task and RxJS tests, are not affected by the Nimble utility functions.
 */
describe('Asynchronous Test Scenarios', () => {
  let component: FixtureComponent;
  let fixture: ComponentFixture<FixtureComponent>;
  let zone: NgZone;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [
        FixtureComponent
      ],
      imports: [
        NimbleButtonModule,
        NimbleMenuButtonModule,
        NimbleMenuItemModule,
        NimbleMenuModule,
        NimbleTextFieldModule,
        NimbleThemeProviderModule
      ]
    });

    fixture = TestBed.createComponent(FixtureComponent);
    component = fixture.componentInstance;
    zone = TestBed.inject(NgZone);

    fixture.detectChanges();
    // Don't allow tasks queued by Nimble to break waitForUpdatesAsync.
    // https://github.com/ni/nimble/issues/1933
    processUpdates();
  });

  it('tick executes all microtasks and macrotasks', fakeAsync(() => {
    const spy = jasmine.createSpy('interval');
    zone.runTask(() => queueMicrotask(() => { }));
    zone.runTask(() => setInterval(spy, 1));
    zone.runTask(() => queueMicrotask(() => { }));
    expect(zone.hasPendingMicrotasks).toBeTrue();
    expect(zone.hasPendingMacrotasks).toBeTrue();

    tick(1);
    expect(zone.hasPendingMicrotasks).toBeFalse();
    expect(zone.hasPendingMacrotasks).toBeTrue();
    expect(spy).toHaveBeenCalledOnceWith();

    discardPeriodicTasks();
  }));

  it('flush executes all microtasks and non-periodic macrotasks', fakeAsync(() => {
    const spy = jasmine.createSpy('interval');
    zone.runTask(() => queueMicrotask(() => { }));
    zone.runTask(() => setTimeout(spy));
    zone.runTask(() => queueMicrotask(() => { }));
    expect(zone.hasPendingMicrotasks).toBeTrue();
    expect(zone.hasPendingMacrotasks).toBeTrue();

    flush();
    expect(zone.hasPendingMicrotasks).toBeFalse();
    expect(spy).toHaveBeenCalledOnceWith();
  }));

  it('flush does execute periodic macrotasks', fakeAsync(() => {
    const spy = jasmine.createSpy('interval');
    zone.runTask(() => setInterval(spy, 1));
    expect(zone.hasPendingMacrotasks).toBeTrue();

    flush();
    expect(spy).not.toHaveBeenCalled();

    discardPeriodicTasks();
  }));

  it('ComponentFixture.whenStable executes all microtasks', waitForAsync(async () => {
    zone.runTask(() => queueMicrotask(() => { }));
    zone.runTask(() => queueMicrotask(() => { }));
    expect(zone.hasPendingMicrotasks).toBeTrue();
    await fixture.whenStable();
    expect(zone.hasPendingMicrotasks).toBeFalse();
  }));

  /**
   * The RxJS timer operator uses the AsyncScheduler by default which creates periodic tasks with setInterval. Timer
   * requires an interval.
   */

  it('RxJS timer with tick executes periodic tasks', fakeAsync(() => {
    zone.runTask(() => timer(1).subscribe());
    expect(hasPeriodicTask()).toBeTrue();
    // Tick executes periodic timers.
    tick(1);
    expect(hasPeriodicTask()).toBeFalse();
  }));

  it('RxJS timer with flush does not execute periodic tasks', fakeAsync(() => {
    zone.runTask(() => timer(1).subscribe());
    expect(hasPeriodicTask()).toBeTrue();
    // Flush does not execute periodic timers.
    flush();
    expect(hasPeriodicTask()).toBeTrue();
    discardPeriodicTasks();
  }));

  it('RxJS timer with ComponentFixture.whenStable executes periodic tasks', waitForAsync(async () => {
    zone.runTask(() => timer(1).subscribe());
    expect(hasPeriodicTask()).toBeTrue();
    // Tick executes periodic timers.
    await fixture.whenStable();
    expect(hasPeriodicTask()).toBeFalse();
  }));

  /**
   * Animation frames are not periodic tasks. However, AnimationFrameScheduler will fallback to AsyncScheduler when
   * used with certain operators, including delay and debounceTime.
   */

  it('RxJS delay with animation frames and flush does not execute periodic tasks', fakeAsync(() => {
    const observable = new Observable(subscriber => subscriber.next(null));
    zone.runTask(() => observable.pipe(delay(1, animationFrameScheduler)).subscribe());
    expect(hasPeriodicTask()).toBeTrue();
    // Flush will not execute the periodic tasks the scheduler fell back to.
    flush();
    expect(hasPeriodicTask()).toBeTrue();
    discardPeriodicTasks();
  }));

  it('RxJS debounceTime with animation frames and flush does not execute periodic tasks', fakeAsync(() => {
    const observable = new Observable(subscriber => subscriber.next(null));
    zone.runTask(() => observable.pipe(debounceTime(1, animationFrameScheduler)).subscribe());
    expect(hasPeriodicTask()).toBeTrue();
    // Flush will not execute the periodic tasks the scheduler fell back to.
    flush();
    expect(hasPeriodicTask()).toBeTrue();
    discardPeriodicTasks();
  }));

  /**
   * Some Nimble component attributes update asynchronously, but not all work with fakeAsync.
   */

  it('Nimble button\'s appearance attribute does not update asynchronously with fakeAsync', fakeAsync(() => {
    component.appearance = ButtonAppearance.ghost;
    fixture.detectChanges();
    tick(1);
    flush();

    expect(component.isButtonGhost()).toBeFalse();
  }));

  it('Nimble button\'s appearance attribute updates asynchronously with ComponentFixture.whenStable', waitForAsync(async () => {
    component.appearance = ButtonAppearance.ghost;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.isButtonGhost()).toBeTrue();
  }));

  it('Nimble button\'s appearance attribute updates asynchronously with processUpdates', () => {
    component.appearance = ButtonAppearance.ghost;
    fixture.detectChanges();
    processUpdates();

    expect(component.isButtonGhost()).toBeTrue();
  });

  it('Nimble button\'s appearance attribute updates asynchronously with waitForUpdatesAsync', async () => {
    component.appearance = ButtonAppearance.ghost;
    fixture.detectChanges();
    await waitForUpdatesAsync();

    expect(component.isButtonGhost()).toBeTrue();
  });

  it('Nimble\'s text field value updates asynchronously with tick', fakeAsync(() => {
    component.value = 'value';
    fixture.detectChanges();
    tick(1);

    expect(component.getTextValue()).toBe('value');
  }));

  it('Nimble\'s text field value updates asynchronously with flush', fakeAsync(() => {
    component.value = 'value';
    fixture.detectChanges();
    flush();

    expect(component.getTextValue()).toBe('value');
  }));

  it('Nimble\'s text field value updates asynchronously with ComponentFixture.whenStable', waitForAsync(async () => {
    component.value = 'value';
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.getTextValue()).toBe('value');
  }));

  it('Nimble\'s text field value updates asynchronously with processUpdates', () => {
    component.value = 'value';
    fixture.detectChanges();
    processUpdates();

    expect(component.getTextValue()).toBe('value');
  });

  it('Nimble\'s text field value updates asynchronously with waitForUpdatesAsync', async () => {
    component.value = 'value';
    fixture.detectChanges();
    await waitForUpdatesAsync();

    expect(component.getTextValue()).toBe('value');
  });

  it('Nimble\'s menu button does not open asynchronously with fakeAsync', fakeAsync(() => {
    component.clickMenuButton();
    fixture.detectChanges();
    tick(1);
    flush();

    expect(component.hasMenuButtonItems()).toBeFalse();
  }));

  it('Nimble\'s menu button opens asynchronously with ComponentFixture.whenStable', waitForAsync(async () => {
    component.clickMenuButton();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.hasMenuButtonItems()).toBeTrue();
  }));

  it('Nimble\'s menu button opens asynchronously with processUpdates', () => {
    component.clickMenuButton();
    fixture.detectChanges();
    processUpdates();

    expect(component.hasMenuButtonItems()).toBeFalse();
  });

  it('Nimble\'s menu button opens asynchronously with waitForUpdatesAsync', async () => {
    component.clickMenuButton();
    fixture.detectChanges();
    await waitForUpdatesAsync();

    expect(component.hasMenuButtonItems()).toBeTrue();
  });
});

function hasPeriodicTask(): boolean {
    const spec = Zone.current.get('FakeAsyncTestZoneSpec');
    if (spec) return !!spec.pendingPeriodicTimers.length;
    return Zone.current.get('ProxyZoneSpec').tasks.some((task: any) => task.data.isPeriodic);
}

@Component({
    template: `
        <nimble-theme-provider theme="light">
          <nimble-button [appearance]="appearance"></nimble-button>
          <nimble-text-field [value]="value"></nimble-text-field>
          <nimble-menu-button>
            <nimble-menu slot="menu">
              <nimble-menu-item>Item 1</nimble-menu-item>
            </nimble-menu>
          </nimble-menu-button>
        </nimble-theme-provider>
    `
})
class FixtureComponent {
  appearance: ButtonAppearance = ButtonAppearance.outline;
  value = '';

  constructor(private element: ElementRef<HTMLElement>) { }

  clickMenuButton() {
    this.getMenuButton().click();
  }

  getTextValue() {
    const field = this.element.nativeElement.querySelector<TextField>('nimble-text-field')!;
    return field.value;
  }

  hasMenuButtonItems() {
    return !!(this.getMenuButton().querySelector<Menu>('nimble-menu')!.items as unknown as MenuItem[]).length;
  }

  isButtonGhost() {
    const button = this.element.nativeElement.querySelector<Button>('nimble-button')!;
    return button.getAttribute('appearance') === ButtonAppearance.ghost;
  }

  setButtonGhost() { this.appearance = ButtonAppearance.ghost; }

  private getMenuButton() {
    return this.element.nativeElement.querySelector<TextField>('nimble-menu-button')!;
  }
}