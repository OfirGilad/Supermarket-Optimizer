import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageCanvasEditingComponent } from './image-canvas-editing.component';

describe('ImageCanvasEditingComponent', () => {
  let component: ImageCanvasEditingComponent;
  let fixture: ComponentFixture<ImageCanvasEditingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ImageCanvasEditingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ImageCanvasEditingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
