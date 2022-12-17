import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { fromEvent, pairwise, switchMap, takeUntil } from 'rxjs';
import { ImageCanvasEditingService } from '../image-canvas-editing.service';
import { OpenCVService } from '../opencv.service';
import { MetadataService } from '../metadata.service';

@Component({
  selector: 'app-image-canvas-editing',
  templateUrl: './image-canvas-editing.component.html',
  styleUrls: ['./image-canvas-editing.component.css'],
  template: `
    <canvas #canvas width="600" height="300"></canvas>
  `,
  styles: ['canvas { border-style: solid }']
})
export class ImageCanvasEditingComponent implements OnInit {

  currentImagePath: string = "";

  @ViewChild('canvas', { static: true })
  canvas: ElementRef<HTMLCanvasElement>;  

  private ctx: CanvasRenderingContext2D;
  image = new Image();

  constructor(
    private imageCanvasEditingService: ImageCanvasEditingService,
    private openCVService: OpenCVService,
    private metadataService: MetadataService,
  ) { }

  @ViewChild('area') menuArea;

  ngOnInit(): void {
    // Clean Canvas
    this.ctx = this.canvas.nativeElement.getContext('2d');
    this.image.src = "";
    this.ctx.drawImage(this.image, 0, 0);

    // Get notify on image recived
    this.imageCanvasEditingService.imagePathChangedEvent.subscribe((newImageJSON: JSON) => {
      const img = new Image();
      img.src = newImageJSON['url'];
      
      this.MetaDataText.nativeElement.value = newImageJSON['metadata'];
      this.MetajsonTxt = newImageJSON['metadata'];

      img.onload = () => {
        this.canvas.nativeElement.width = img.width;
        this.canvas.nativeElement.height = img.height;
        this.ctx = this.canvas.nativeElement.getContext('2d');
        this.ctx.clearRect(0, 0, img.width, img.height);
        this.ctx.drawImage(img, 0, 0);

        this.currentImagePath = newImageJSON['url']
        
        this.menuArea.nativeElement.style.width = img.width + 'px';
        this.menuArea.nativeElement.style.height = img.height + 'px';

        this.SendMetaData();
      }
    })
    
  }

  @ViewChild('cvInput') cvInput;

  @ViewChild('MetaData') metaData;

  @ViewChild('textInput') textInput;

  CurrentClicked: string = "";
  LastClicked: string = "";

  CurrentPolygonMeta = [];
  CurrentPolylineMeta = [];
  

  // For Text
  pos1: number = 0;
  pos2: number = 0;


  // For Polyline
  x1: number = 0;
  y1: number = 0;
  x2: number = 0;
  y2: number = 0;
  onFirstSelectLine: boolean = true;
  selectedPointsPolylineList: number[] = [];


  // For Polygon
  firstX: number = 0;
  firstY: number = 0;
  lastX: number = 0;
  lastY: number = 0;
  onFirstSelectGon: boolean = true;
  selectedPointsPolygonList: number[] = [];
  

  // For Rectangle
  rec_x1: number = 0;
  rec_y1: number = 0;
  rec_x2: number = 0;
  rec_y2: number = 0;
  onFirstSelectRec: boolean = true;
  

  disableOtherOptions() {
    if (this.CurrentClicked != "Polygon"){
        this.LastClicked = this.CurrentClicked;
        this.CurrentClicked = "Polygon";
        this.DrawPolygon();
    }
    this.CurrentClicked = this.LastClicked;
    if (this.CurrentClicked != "Polyline"){
      this.CurrentClicked = "Polyline";
      this.DrawPolyline();
    }

    this.CurrentClicked = "Metadata";
    this.CallMetaData();
    this.CurrentClicked = "OpenCV";
    this.CVFunction();
    this.CurrentClicked = "Text";
    this.Text();
    this.CurrentClicked = "Rectangle";
    this.DrawRectangle();
    this.CurrentClicked = "FreeDraw";
    this.FreeDrawLine();

    this.LastClicked = "";
  }


  // EditMode - Modes
  edit_mode_annotation_selected: boolean = false
  edit_mode_annotation_verified: boolean = false
  edit_mode_point_selected: boolean = false
  move_all_points: boolean = false


  OnClick(e: any) {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    var rect = this.canvas.nativeElement.getBoundingClientRect();

    if (this.CurrentClicked == "EditMode"){
      this.disableOtherOptions()
      this.CurrentClicked = "EditMode";

      // Used to reset green dots after selectiom
      this.SendMetaData()
      this.CurrentClicked = "EditMode";

      var User_X = e.pageX - rect.left
      var User_Y = e.pageY - rect.top

      // Selecting Annotation
      if (this.edit_mode_annotation_selected == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findClosestAnnotation(User_X, User_Y)
          this.CurrentClicked = "EditMode";
        }
      }
      else {
        // Selecting Point
        if (this.edit_mode_point_selected == false) {
          this.selectClosestPoint(User_X, User_Y)
          this.CurrentClicked = "EditMode";
        }
        else {
          // Selecting new Point coordinates
          this.setSelectedPoint(User_X, User_Y)
          this.edit_mode_annotation_selected = false
          this.edit_mode_point_selected = false       
        }
      }
    }
    else if (this.CurrentClicked == "Metadata"){
      this.disableOtherOptions()
      this.CurrentClicked = "Metadata";
      
      this.metaData.nativeElement.style.display = "block";
      this.metaData.nativeElement.style.top = e.pageY + "px";
      this.metaData.nativeElement.style.left = e.pageX + "px";
    }
    else if (this.CurrentClicked == "OpenCV"){
      this.disableOtherOptions()
      this.CurrentClicked = "OpenCV";

      this.textToCV.nativeElement.value = "{}";
      this.cvInput.nativeElement.style.display = "block";
      this.cvInput.nativeElement.style.top = e.pageY + "px";
      this.cvInput.nativeElement.style.left = e.pageX + "px";
    }
    else if (this.CurrentClicked == "Text"){
      this.disableOtherOptions()
      this.CurrentClicked = "Text";

      this.textInput.nativeElement.style.display = "block";
      this.textInput.nativeElement.style.top = e.pageY + "px";
      this.textInput.nativeElement.style.left = e.pageX + "px";
      this.pos1 = e.clientX
      this.pos2 = e.clientY
    }
    else if (this.CurrentClicked == "Polyline"){
      this.DisableEditMode()
      this.disableOtherOptions()
      this.CurrentClicked = "Polyline";

      if (this.onFirstSelectLine){
        this.x1 = e.clientX - rect.left
        this.y1 = e.clientY - rect.top
        this.onFirstSelectLine = false

        this.selectedPointsPolylineList.push(this.x1)
        this.selectedPointsPolylineList.push(this.y1)
      }
      else{
        this.x2 = e.clientX - rect.left
        this.y2 = e.clientY - rect.top
        this.selectedPointsPolylineList.push(this.x2)
        this.selectedPointsPolylineList.push(this.y2)
        this.drawLine(this.x1, this.y1, this.x2, this.y2)
        this.x1 = this.x2
        this.y1 = this.y2
      }
    }
    else if (this.CurrentClicked == "Polygon"){
      this.disableOtherOptions()
      this.CurrentClicked = "Polygon";

      if (this.onFirstSelectGon){
        this.firstX = e.clientX - rect.left
        this.firstY = e.clientY - rect.top
        this.onFirstSelectGon = false

        this.selectedPointsPolygonList.push(this.firstX)
        this.selectedPointsPolygonList.push(this.firstY)
      }
      else{
        this.lastX = e.clientX - rect.left
        this.lastY = e.clientY - rect.top
        this.selectedPointsPolygonList.push(this.lastX)
        this.selectedPointsPolygonList.push(this.lastY)
        this.drawLine(this.firstX, this.firstY, this.lastX, this.lastY)
        this.firstX = this.lastX
        this.firstY = this.lastY
      }
    }
    else if (this.CurrentClicked == "Rectangle"){
      this.disableOtherOptions()
      this.CurrentClicked = "Rectangle";

      if (this.onFirstSelectRec){
        this.rec_x1 = e.clientX - rect.left
        this.rec_y1 = e.clientY - rect.top
        this.onFirstSelectRec = false;
      } else {
        this.rec_x2 = e.clientX - rect.left
        this.rec_y2 = e.clientY - rect.top
        this.drawLine(this.rec_x1,this.rec_y1,this.rec_x2,this.rec_y1);
        this.drawLine(this.rec_x1,this.rec_y1,this.rec_x1,this.rec_y2);
        this.drawLine(this.rec_x1,this.rec_y2,this.rec_x2,this.rec_y2);
        this.drawLine(this.rec_x2,this.rec_y1,this.rec_x2,this.rec_y2);
        // console.log(this.MetajsonTxt)
        // add to metadata
        var json = JSON.parse(this.MetajsonTxt);
        var line = json.Rectangles;
        if (line == undefined)
          json.Rectangles = [[[this.rec_x1, this.rec_y1], [this.rec_x2, this.rec_y2]]]
        else
          json.Rectangles.push([[this.rec_x1, this.rec_y1], [this.rec_x2, this.rec_y2]])
        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        // end add to metadata    
        //console.log(this.MetajsonTxt)
        this.onFirstSelectRec = true;
      }
    }
    else {
      this.textInput.nativeElement.style.display = "none";
      this.disappearContext()
    } 
  }

  OnEnter(e: any) {
    // console.log(this.CurrentClicked)
    if (this.CurrentClicked == "Text") {
      this.textInput.nativeElement.style.display = "none";
      this.ctx = this.canvas.nativeElement.getContext('2d');
      // console.log(this.textInput.nativeElement.value);

      var rect = this.canvas.nativeElement.getBoundingClientRect();

      this.ctx.font = "15px Arial";
      this.ctx.fillText(this.textInput.nativeElement.value, 
        this.pos1 - rect.left, this.pos2 - rect.top + 15);
      
      // add to metadata
      var json = JSON.parse(this.MetajsonTxt);
      var text = json.Texts;
      if (text == undefined)
        json.Texts = [[this.textInput.nativeElement.value, this.pos1 - rect.left, this.pos2 - rect.top + 15]]
      else
        json.Texts.push([this.textInput.nativeElement.value, this.pos1 - rect.left, this.pos2 - rect.top + 15])
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
      // end add to metadata
      this.CurrentClicked = "";
    }
    else if (this.CurrentClicked == "EditMode") {
      this.textInput.nativeElement.style.display = "none";
      var new_text = this.textInput.nativeElement.value

      var json = JSON.parse(this.MetajsonTxt);
      var annotation_x = json.Texts[this.annotation_index][1]
      var annotation_y = json.Texts[this.annotation_index][2]
      json.Texts[this.annotation_index] = [new_text, annotation_x, annotation_y]
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
      
      // Finish Text Edit
      this.edit_mode_annotation_selected = false
      this.edit_mode_annotation_verified = false
      this.edit_mode_point_selected = false
      this.CurrentClicked = "";
      this.SendMetaData()
    }
  }

  // Right Click Menu - START
  @ViewChild('menu') menu!: ElementRef;

  contextMenu(e: any){
    e.preventDefault();
    if (this.edit_mode_point_selected == false) {
      this.menu.nativeElement.style.display = "block";
      this.menu.nativeElement.style.top = e.pageY + "px";
      this.menu.nativeElement.style.left = e.pageX + "px";
    }
    else if (this.annotation_type == "Texts") { 
      this.ctx = this.canvas.nativeElement.getContext('2d');
      var rect = this.canvas.nativeElement.getBoundingClientRect();

      // Edit current Text Box
      this.textInput.nativeElement.style.display = "block";
      this.textInput.nativeElement.style.top = this.min_y + rect.top - 15 + "px";
      this.textInput.nativeElement.style.left = this.min_x + rect.left + "px";
    }
    else if (this.annotation_type != "Texts") {
      this.ctx = this.canvas.nativeElement.getContext('2d');
      var rect = this.canvas.nativeElement.getBoundingClientRect();

      for (let i = 0; i < this.annotation_data.length; i++) {
        if (i != this.point_index) {
          this.color_point(this.annotation_data[i][0], this.annotation_data[i][1], 'yellow')
        }
      }
      this.move_all_points = true
    }
  }

  disappearContext(){
    this.menu.nativeElement.style.display = "none";
  }

  stopPropagation(e: any){
    e.stopPropagation();
  }
  // Right Click Menu - END

  // Draw on canvas - START
  private captureEvents(canvasEl: HTMLCanvasElement) {
    // this will capture all mousedown events from the canvas element
    fromEvent(canvasEl, 'mousedown')
      .pipe(
        switchMap((e) => {
          // after a mouse down, we'll record all mouse moves
          return fromEvent(canvasEl, 'mousemove')
            .pipe(
              // we'll stop (and unsubscribe) once the user releases the mouse
              // this will trigger a 'mouseup' event    
              takeUntil(fromEvent(canvasEl, 'mouseup')),
              // we'll also stop (and unsubscribe) once the mouse leaves the canvas (mouseleave event)
              takeUntil(fromEvent(canvasEl, 'mouseleave')),
              // pairwise lets us get the previous value to draw a line from
              // the previous point to the current point    
              pairwise()
            )
        })
      )
      .subscribe((res: [MouseEvent, MouseEvent]) => {
        const rect = canvasEl.getBoundingClientRect();
  
        // previous and current position with the offset
        const prevPos = {
          x: res[0].clientX - rect.left,
          y: res[0].clientY - rect.top
        };
  
        const currentPos = {
          x: res[1].clientX - rect.left,
          y: res[1].clientY - rect.top
        };
  
        // this method we'll implement soon to do the actual drawing
        this.drawOnCanvas(prevPos, currentPos);
      });
  }

  private drawOnCanvas(
    prevPos: { x: number, y: number }, 
    currentPos: { x: number, y: number }
  ) {
    // incase the context is not set
    if (!this.ctx) { return; }
  
    // start our drawing path
    this.ctx.beginPath();
  
    // we're drawing lines so we need a previous position
    if (prevPos) {
      // sets the start point
      this.ctx.moveTo(prevPos.x, prevPos.y); // from
  
      // draws a line from the start pos until the current position
      this.ctx.lineTo(currentPos.x, currentPos.y);
  
      // strokes the current path with the styles we set earlier
      this.ctx.stroke();
    }
  }
  // Draw on canvas - END


  // Edit Mode - START
  annotation_index = 0
  annotation_type: string = ''
  annotation_data = []
  point_index = 0
  min_x = 0
  min_y = 0
  min_x_dist = 0
  min_y_dist = 0

  findClosestAnnotation(x1, y1) {
    this.annotation_type = ''
    this.annotation_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let texts = json["Texts"];
    let lines = json["Polylines"];
    let gons = json["Polygons"];
    let recs = json["Rectangles"];
    
    let curr = [];

     // Check Texts
     if (texts != null) {
      for (let i = 0; i < texts.length; i++) {
        curr = texts[i];
        var x2 = curr[1]
        var y2 = curr[2]
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.annotation_index = i
          this.annotation_type = 'Texts'
          this.annotation_data = curr
        }
      }
    }

    // Check Polylines
    if (lines != null) {
      for (let i = 0; i < lines.length; i++) {
        curr = lines[i];
        for (let j = 0; j < curr.length; j++) {
          var x2 = curr[j][0]
          var y2 = curr[j][1]
          var distance = this.points_distance(x1, y1, x2, y2)

          if (distance < min_distance) {
            min_distance = distance
            this.annotation_index = i
            this.annotation_type = 'Polylines'
            this.annotation_data = curr
          }
        }
      }
    }

    // Check Polygons
    if (gons != null) {
      for (let i = 0; i < gons.length; i++) {
        curr = gons[i];
        for (let j = 0; j < curr.length; j++) {
          var x2 = curr[j][0]
          var y2 = curr[j][1]
          var distance = this.points_distance(x1, y1, x2, y2)

          if (distance < min_distance) {
            min_distance = distance
            this.annotation_index = i
            this.annotation_type = 'Polygons'
            this.annotation_data = curr
          }
        }
      }
    }
    
    // Check Rectagles
    if (recs != null) {
      for (let i = 0; i < recs.length; i++) {
        curr = recs[i];
        for (let j = 0; j < 2; j++) {
          for (let k = 0; k < 2; k++) {
            var x2 = curr[j][0]
            var y2 = curr[k][1]
            var distance = this.points_distance(x1, y1, x2, y2)

            if (distance < min_distance) {
              min_distance = distance
              this.annotation_index = i
              this.annotation_type = 'Rectangles'
              this.annotation_data = curr
            }
          }
        }
      }
    }

    console.log("Selected:", this.annotation_type)
    if (this.annotation_type == 'Texts') {
      var selected_x = this.annotation_data[1]
      var selected_y = this.annotation_data[2]
      this.color_point(selected_x, selected_y)
      this.edit_mode_annotation_selected = true
    }
    else if (this.annotation_type == 'Polylines') {
      for (let i = 0; i < this.annotation_data.length; i++) {
        this.color_point(this.annotation_data[i][0], this.annotation_data[i][1])
      }
      this.edit_mode_annotation_selected = true
    }
    else if (this.annotation_type == 'Polygons') {
      for (let i = 0; i < this.annotation_data.length; i++) {
        this.color_point(this.annotation_data[i][0], this.annotation_data[i][1])
      }
      this.edit_mode_annotation_selected = true
    }
    else if (this.annotation_type == 'Rectangles') {
      for (let j = 0; j < 2; j++) {
        this.color_point(this.annotation_data[j][0],  this.annotation_data[j][1])
      }
      this.edit_mode_annotation_selected = true
    }
  }

  points_distance(x1, y1, x2, y2) {
    // console.log("USER",x1,y1)
    // console.log("CANVAS",x2,y2)
    
    // Euclidian - Too many Overflows / Underflows
    // var sum1 = (x2 - x1)^2
    // var sum2 = (y2 - y1)^2
    // var result =  Math.sqrt(sum1 + sum2)

    // Manethen
    var sum1 = Math.abs(x2 - x1)
    var sum2 = Math.abs(y2 - y1)
    var result = sum1 + sum2

    // console.log("RESULT",result)
    return result
  }

  color_point(x, y, color='green') {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    var rect = this.canvas.nativeElement.getBoundingClientRect();

    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.fillStyle = 'black';
    this.ctx.stroke();
  }

  selectClosestPoint(x1, y1) {
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width

    if (this.annotation_type == 'Texts') {
      this.min_x = this.annotation_data[1]
      this.min_y = this.annotation_data[2]
      
      this.edit_mode_point_selected = true
    }
    else if (this.annotation_type == 'Polylines') {
      for (let i = 0; i < this.annotation_data.length; i++) {
        var x2 = this.annotation_data[i][0]
        var y2 = this.annotation_data[i][1]
        var distance = this.points_distance(x1 ,y1, x2, y2)

        if (distance < min_distance) {
          min_distance = distance
          this.point_index = i
          this.min_x = x2
          this.min_y = y2
        }
      }
      this.edit_mode_point_selected = true
    }
    else if (this.annotation_type == 'Polygons') {
      for (let i = 0; i < this.annotation_data.length; i++) {
        var x2 = this.annotation_data[i][0]
        var y2 = this.annotation_data[i][1]
        var distance = this.points_distance(x1 ,y1, x2, y2)

        if (distance < min_distance) {
          min_distance = distance
          this.point_index = i
          this.min_x = x2
          this.min_y = y2
        }
      }
      this.edit_mode_point_selected = true
    }
    else if (this.annotation_type == 'Rectangles') {
      for (let j = 0; j < 2; j++) {
        var x2 = this.annotation_data[j][0]
        var y2 = this.annotation_data[j][1]
        var distance = this.points_distance(x1 ,y1, x2, y2)

        if (distance < min_distance) {
          min_distance = distance
          this.point_index = j
          this.min_x = x2
          this.min_y = y2
        }
      }
      this.edit_mode_point_selected = true
    }

    this.color_point(this.min_x, this.min_y, 'red')
  }

  setSelectedPoint(x, y) {
    this.min_x_dist = x - this.min_x
    this.min_y_dist = y - this.min_y

    // update to metadata
    if (this.annotation_type  == 'Texts') {
      var json = JSON.parse(this.MetajsonTxt);
      var annotation_text = json.Texts[this.annotation_index][0]
      json.Texts[this.annotation_index] = [annotation_text, x, y]
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
      
      this.SendMetaData()
    }
    else if (this.annotation_type  == 'Polylines') {
      // Move all points
      if (this.move_all_points == true) {
        this.move_all_points = false
        var json = JSON.parse(this.MetajsonTxt);
        json.Polylines[this.annotation_index][this.point_index] = [x, y]

        for (let i = 0; i < json.Polylines[this.annotation_index].length; i++) {
          if (i != this.point_index) {
            var old_x = json.Polylines[this.annotation_index][i][0]
            var old_y = json.Polylines[this.annotation_index][i][1]
            json.Polylines[this.annotation_index][i] = [old_x + this.min_x_dist, old_y + this.min_y_dist]
          }
        }

        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        this.SendMetaData()
      }
      // Move only 1 point
      else {
        var json = JSON.parse(this.MetajsonTxt);
        json.Polylines[this.annotation_index][this.point_index] = [x, y]
        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        this.SendMetaData()
      }
    }
    else if (this.annotation_type  == 'Polygons') {
      // Move all points
      if (this.move_all_points == true) {
        this.move_all_points = false
        var json = JSON.parse(this.MetajsonTxt);
        json.Polygons[this.annotation_index][this.point_index] = [x, y]

        for (let i = 0; i < json.Polygons[this.annotation_index].length; i++) {
          if (i != this.point_index) {
            var old_x = json.Polygons[this.annotation_index][i][0]
            var old_y = json.Polygons[this.annotation_index][i][1]
            json.Polygons[this.annotation_index][i] = [old_x + this.min_x_dist, old_y + this.min_y_dist]
          }
        }

        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        this.SendMetaData()
      }
      // Move only 1 point
      else {
        var json = JSON.parse(this.MetajsonTxt);
        json.Polygons[this.annotation_index][this.point_index] = [x, y]
        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        this.SendMetaData()
      }
    }
    else if (this.annotation_type  == 'Rectangles') {
      // Move all points
      if (this.move_all_points == true) {
        this.move_all_points = false
        var json = JSON.parse(this.MetajsonTxt);
        json.Rectangles[this.annotation_index][this.point_index] = [x, y]

        for (let i = 0; i < json.Rectangles[this.annotation_index].length; i++) {
          if (i != this.point_index) {
            var old_x = json.Rectangles[this.annotation_index][i][0]
            var old_y = json.Rectangles[this.annotation_index][i][1]
            json.Rectangles[this.annotation_index][i] = [old_x + this.min_x_dist, old_y + this.min_y_dist]
          }
        }

        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        this.SendMetaData()
      }
      // Move only 1 point
      else {
        var json = JSON.parse(this.MetajsonTxt);
        json.Rectangles[this.annotation_index][this.point_index] = [x, y]
        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        this.SendMetaData()
      }
    }
  }
  // Edit Mode - END


  // Buttons Implementation - START
  EditAnnotationsMode() {
    this.edit_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "EditMode") {
      // this.OptionSelected(1)

      // Enable Edit Mode
      this.CurrentClicked = "EditMode";
      this.disableOtherOptions()
      this.CurrentClicked = "EditMode";
    }
    else {
      this.edit_in_progress = false
      this.DisableEditMode()
      this.CurrentClicked = "";
      //this.ClearAnnotations(false)
    }
  }

  edit_in_progress = false

  DisableEditMode() {
    if (this.edit_mode_annotation_selected == true && this.edit_in_progress == false) {
      this.edit_mode_annotation_selected = false
      this.edit_mode_annotation_verified = false
      this.edit_mode_point_selected = false
      this.SendMetaData()
    }
  }

  CVFunction() {
    this.disappearContext();
    if (this.CurrentClicked != "OpenCV") {
      // this.OptionSelected(3)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditMode()

      this.CurrentClicked = "OpenCV";
      this.disableOtherOptions()
      this.CurrentClicked = "OpenCV";
    }
    else {
      this.CurrentClicked = "";
      this.cvInput.nativeElement.style.display = "none";
    }
  }

  CallMetaData(){
    this.disappearContext();
    if(this.CurrentClicked != "Metadata") {
      // this.OptionSelected(2)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditMode()

      this.CurrentClicked = "Metadata";
      this.disableOtherOptions()
      this.CurrentClicked = "Metadata";
    }
    else {
      this.CurrentClicked = "";
      this.metaData.nativeElement.style.display = "none";
    }
  }

  @ViewChild('MetaDataText') MetaDataText;
  MetajsonTxt: string = "{}"

  SendMetaData(){
    this.ClearAnnotations(false)
    this.MetajsonTxt = this.MetaDataText.nativeElement.value;
    this.DrawMetaData();
  }

  DrawMetaData(){
    var json = JSON.parse(this.MetajsonTxt);
    let texts = json["Texts"];
    let lines = json["Polylines"];
    let gons = json["Polygons"];
    let recs = json["Rectangles"];
    
    let curr = [];

     // Draw Texts
     if (texts != null) {
      for (let i = 0; i < texts.length; i++) {
        curr = texts[i];
        this.ctx = this.canvas.nativeElement.getContext('2d');

        this.ctx.font = "15px Arial";
        this.ctx.fillText(curr[0], curr[1], curr[2]);
      }
    }

    // Draw Polylines
    if (lines != null) {
      for (let i = 0; i < lines.length; i++) {
        curr = lines[i];
        for (let j = 0; j < curr.length-1; j++) {
          this.drawLine(curr[j][0], curr[j][1], curr[j+1][0], curr[j+1][1]);
        }
      }
    }

    // Draw Polygons
    if (gons != null) {
      for (let i = 0; i < gons.length; i++) {
        curr = gons[i];
        for (let j = 0; j < curr.length-1; j++) {
          this.drawLine(curr[j][0], curr[j][1], curr[j+1][0], curr[j+1][1]);
        }
        this.drawLine(curr[0][0], curr[0][1], curr[curr.length-1][0], curr[curr.length-1][1]);
      }
    }
    
    // Draw Rectagles
    if (recs != null) {
      for (let i = 0; i < recs.length; i++) {
        curr = recs[i];
        this.drawLine(curr[0][0], curr[0][1], curr[0][0], curr[1][1]);
        this.drawLine(curr[0][0], curr[0][1], curr[1][0], curr[0][1]);
        this.drawLine(curr[1][0], curr[0][1], curr[1][0], curr[1][1]);
        this.drawLine(curr[0][0], curr[1][1], curr[1][0], curr[1][1]);
      }
    }
  }

  @ViewChild('FunctionTextToCV') functionTextToCV;

  @ViewChild('TextToCV') textToCV;
  CVjsonText: string = '{}'

  cv_call_image: boolean = false

  async OpenCVCall(){
    this.CVjsonText = this.textToCV.nativeElement.value

    var jsonParams = JSON.parse(this.CVjsonText)
    jsonParams['url'] = this.currentImagePath

    var selectedFunction = this.functionTextToCV.nativeElement;
    jsonParams['method'] = selectedFunction.options[selectedFunction.selectedIndex].value;
    
    console.log("Sent Json:", jsonParams)

    this.cv_call_image = true

    this.openCVService.getOpenCVResult(jsonParams).subscribe((data: any)=>{
      // console.log(data);
      var ctx = this.canvas.nativeElement.getContext('2d');
      var image = new Image();

      image.onload = () => {
          ctx.drawImage(image, 0, 0);
      }
      image.src = data;
      this.currentImagePath = data
      this.cvInput.nativeElement.style.display = "none";
    })

    // Set waiting to draw annotation after CV function results
    await this.sleep(10000);
    this.SendMetaData()
  }

  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  SaveMetadata(){
    // this.OptionSelected(0)

    this.CurrentClicked = ""
    this.OnClick("NONE")

    var jsonParams = JSON.parse('{}')
    jsonParams['url'] = this.currentImagePath
    jsonParams['metadata'] = this.MetajsonTxt
    
    console.log("Sent Json:", jsonParams)

    this.metadataService.saveMetadataToFirebase(jsonParams).subscribe((data: any)=>{
      console.log("Metadata URL:", data);
      // window.location.reload();
    })
    
  }

  Text() {
    this.disappearContext();
    if (this.CurrentClicked != "Text") {
      // this.OptionSelected(5)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditMode()

      this.CurrentClicked = "Text";
      this.disableOtherOptions()
      this.CurrentClicked = "Text";
    }
    else {
      this.CurrentClicked ="";
      this.textInput.nativeElement.style.display = "none";
    }
  }

  DrawPolyline() {
    this.disappearContext()
    if (this.CurrentClicked != "Polyline") {
      // this.OptionSelected(6)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditMode()

      this.CurrentClicked = "Polyline";
      this.disableOtherOptions()
      this.CurrentClicked = "Polyline";
      this.onFirstSelectLine = true;
    }
    else{
      this.CurrentClicked = "";
      this.onFirstSelectLine = true;
      for(var i = 0; i < this.selectedPointsPolylineList.length;i+=2){
        this.CurrentPolylineMeta.push([this.selectedPointsPolylineList[i],this.selectedPointsPolylineList[i+1]])
      }
      // add to metadata
      var json = JSON.parse(this.MetajsonTxt);
      var line = json.Polylines;
      if (line == undefined && this.CurrentPolylineMeta.length > 0)
        json.Polylines = [this.CurrentPolylineMeta];
      else if (this.CurrentPolylineMeta.length > 0)
        json.Polylines.push(this.CurrentPolylineMeta);
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
      //console.log(this.MetajsonTxt);
      // end add to metadata
      this.selectedPointsPolylineList = [];
      this.CurrentPolylineMeta = [];
    }
  }

  DrawPolygon() {
    this.disappearContext()
    if (this.CurrentClicked != "Polygon") {
      // this.OptionSelected(7)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditMode()

      this.CurrentClicked = "Polygon";
      this.disableOtherOptions()
      this.CurrentClicked = "Polygon";
      this.onFirstSelectGon = true;
    }
    else{
      this.CurrentClicked = "";
      try{
        this.onFirstSelectGon = true;
        this.drawLine(this.selectedPointsPolygonList[0], 
          this.selectedPointsPolygonList[1], 
          this.selectedPointsPolygonList[this.selectedPointsPolygonList.length - 2], 
          this.selectedPointsPolygonList[this.selectedPointsPolygonList.length - 1]);
        for(var i = 0; i < this.selectedPointsPolygonList.length;i+=2){
          this.CurrentPolygonMeta.push([this.selectedPointsPolygonList[i],this.selectedPointsPolygonList[i+1]])
        }
        // add to metadata
        var json = JSON.parse(this.MetajsonTxt);
        var gon = json.Polygons;
        if (gon == undefined && this.CurrentPolygonMeta.length > 0)
          json.Polygons = [this.CurrentPolygonMeta];
        else if (this.CurrentPolygonMeta.length > 0)
          json.Polygons.push(this.CurrentPolygonMeta);
        this.MetajsonTxt = JSON.stringify(json);
        this.MetaDataText.nativeElement.value = this.MetajsonTxt;
        //console.log(this.MetajsonTxt);
        // end add to metadata
        this.selectedPointsPolygonList = [];
        this.CurrentPolygonMeta = [];
      }
      catch{
        console.log("No Option To Create Polygon")
      }
    }
  }

  DrawRectangle(){
    this.DisableEditMode()
    this.disappearContext()
    if (this.CurrentClicked != "Rectangle"){
      // this.OptionSelected(8)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditMode()

      this.CurrentClicked = "Rectangle";
      this.disableOtherOptions()
      this.CurrentClicked = "Rectangle";
      this.onFirstSelectRec = true;
    }
    else {
      this.CurrentClicked = "";
      //this.onFirstSelectRec = true;
    }
  }

  drawLine(x1, y1, x2, y2) {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    //console.log(x1,y1,x2,y2)
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  FreeDrawLine() {
    this.disappearContext()
    const canvasEl: HTMLCanvasElement = this.canvas.nativeElement;

    if (this.CurrentClicked != "FreeDraw") {
      // this.OptionSelected(4)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditMode()

      this.CurrentClicked = "FreeDraw";
      this.disableOtherOptions()
      this.captureEvents(canvasEl);
      this.CurrentClicked = "FreeDraw";
    }
    else {
      canvasEl.removeAllListeners();
      this.CurrentClicked = "";
    }
  }

  ClearAnnotations(deleteMetadata:boolean = true){
    // this.OptionSelected(0)

    // Disable Edit Mode
    if (deleteMetadata == true) {
      this.edit_in_progress = false
      this.edit_mode_annotation_selected = false
      this.edit_mode_annotation_verified = false
      this.edit_mode_point_selected = false
    }

    let LastMetadata = this.MetaDataText.nativeElement.value;
    this.disableOtherOptions()
    this.disappearContext()
    this.ctx = this.canvas.nativeElement.getContext('2d');

    // Prevent CV returned image from being deleted
    if(this.cv_call_image == false) {
      this.ctx.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);
    }
    
    this.image.src = this.currentImagePath;
    this.ctx.drawImage(this.image, 0, 0);

    try{
      JSON.parse(LastMetadata);
      this.MetaDataText.nativeElement.value = LastMetadata;
    }
    catch{
      console.log("Metadata incorrect JSON format");
    }
    
    if(deleteMetadata)
      this.MetajsonTxt = "{}";
  }
  // Buttons Implementation - END



  // For Future Use

  // Change buttons colors - START
  @ViewChild('Option1') Option1;
  @ViewChild('Option2') Option2;
  @ViewChild('Option3') Option3;
  @ViewChild('Option4') Option4;
  @ViewChild('Option5') Option5;
  @ViewChild('Option6') Option6;
  @ViewChild('Option7') Option7;
  @ViewChild('Option8') Option8;

  OptionSelected(option_num) {
    if (option_num == 0) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 1) {
      this.Option1.nativeElement.style.color = 'green'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 2) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'green'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 3) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'green'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 4) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'green'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 5) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'green'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 6) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'green'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 7) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'green'
      this.Option8.nativeElement.style.color = 'white'
    }
    if (option_num == 8) {
      this.Option1.nativeElement.style.color = 'white'
      this.Option2.nativeElement.style.color = 'white'
      this.Option3.nativeElement.style.color = 'white'
      this.Option4.nativeElement.style.color = 'white'
      this.Option5.nativeElement.style.color = 'white'
      this.Option6.nativeElement.style.color = 'white'
      this.Option7.nativeElement.style.color = 'white'
      this.Option8.nativeElement.style.color = 'green'
    }
  }
  // Change buttons colors - END
}
