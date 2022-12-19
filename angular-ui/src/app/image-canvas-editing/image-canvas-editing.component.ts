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


  // START FROM HERE


  CurrentClicked: string = "";
  LastClicked: string = "";
  
  points_counter: number = 0;

  // For Point
  point_x: number = 0;
  point_y: number = 0;


  disableOtherOptions() {
    this.CurrentClicked = "Point";
    this.DrawPoint();
    this.CurrentClicked = "Metadata";
    this.CallMetaData();
    this.CurrentClicked = "OpenCV";
    this.CVFunction();
    this.LastClicked = "";
  }


  // EditPosition - Modes
  edit_annotations_mode_stage1: boolean = false
  edit_annotations_mode_stage2: boolean = false
  edit_annotations_mode_stage3: boolean = false
  move_all_points: boolean = false

  
  // AddConnection - Modes
  add_connections_mode_stage1: boolean = false
  add_connections_mode_stage2: boolean = false
  add_connections_mode_stage3: boolean = false


  OnClick(e: any) {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    var rect = this.canvas.nativeElement.getBoundingClientRect();

    if (this.CurrentClicked == "EditPosition"){
      this.disableOtherOptions()
      this.CurrentClicked = "EditPosition";

      // Used to reset green dots after selectiom
      this.SendMetaData()
      this.CurrentClicked = "EditPosition";

      var User_X = e.pageX - rect.left
      var User_Y = e.pageY - rect.top

      // Selecting Annotation
      if (this.edit_annotations_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findClosestPoint(User_X, User_Y)
          this.CurrentClicked = "EditPosition";
        }
      }
      else {
        // Selecting new Point coordinates
        this.setSelectedPoint(User_X, User_Y)
        this.edit_annotations_mode_stage1 = false
        this.edit_annotations_mode_stage3 = false
      }
    }

    if (this.CurrentClicked == "AddConnection"){
      this.disableOtherOptions()
      this.CurrentClicked = "AddConnection";

      // Used to reset green dots after selectiom
      this.SendMetaData()
      this.CurrentClicked = "AddConnection";

      var User_X = e.pageX - rect.left
      var User_Y = e.pageY - rect.top


      // Selecting First Point
      if (this.add_connections_mode_stage1 == false) {
        // console.log(this.MetajsonTxt)
        if (this.MetajsonTxt != '{}') {
          this.findFirstPoint(User_X, User_Y)
          this.CurrentClicked = "AddConnection";
        }
      }
      else {
          // Selecting Second Point
          this.findSecondPoint(User_X, User_Y)
          this.add_connections_mode_stage1 = false
          this.add_connections_mode_stage3 = false   
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


    else if (this.CurrentClicked == "Point"){
      this.disableOtherOptions()
      this.CurrentClicked = "Point";

      this.point_x = e.clientX - rect.left
      this.point_y = e.clientY - rect.top
      this.color_point(this.point_x, this.point_y, 'black', 10)

      var json = JSON.parse(this.MetajsonTxt);
      var line = json.Points;
      if (line == undefined)
        json.Points = [[this.point_x, this.point_y]]
      else
        json.Points.push([this.point_x, this.point_y])
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
    }


    else {
      this.textInput.nativeElement.style.display = "none";
      this.disappearContext()
    } 
  }

  OnEnter(e: any) {
    // console.log(this.CurrentClicked)
    
  }

  // Right Click Menu - START
  @ViewChild('menu') menu!: ElementRef;

  contextMenu(e: any){
    e.preventDefault();
    if (this.edit_annotations_mode_stage3 == false) {
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
  // Right Click Menu - END




  // Edit Mode - START
  annotation_index = 0
  annotation_type: string = ''
  annotation_data = []
  point_index = 0
  min_x = 0
  min_y = 0
  min_x_dist = 0
  min_y_dist = 0

  findClosestPoint(x1, y1) {
    this.annotation_type = ''
    this.annotation_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr[0]
        var y2 = curr[1]
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.annotation_index = i
          this.annotation_type = 'Points'
          this.annotation_data = curr
        }
      }

      var selected_x = this.annotation_data[0]
      var selected_y = this.annotation_data[1]
      this.color_point(selected_x, selected_y)
      this.edit_annotations_mode_stage1 = true
    }
  }

  
  setSelectedPoint(x, y) {
    this.min_x_dist = x - this.min_x
    this.min_y_dist = y - this.min_y

    // update to metadata

    if (this.annotation_type  == 'Points') {
      var json = JSON.parse(this.MetajsonTxt);
      json.Points[this.annotation_index] = [x, y]
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
      
      this.SendMetaData()   
    }
  }
  // Edit Mode - END




  // Edit Mode - START
  point1_data = []
  point1_index = 0
  min_x1 = 0
  min_y1 = 0
  min_x_dist1 = 0
  min_y_dist1 = 0

  findFirstPoint(x1, y1) {
    this.point1_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr[0]
        var y2 = curr[1]
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.point1_index = i
          this.point1_data = curr
        }
      }

      var selected_x = this.point1_data[0]
      var selected_y = this.point1_data[1]
      this.color_point(selected_x, selected_y)
      this.add_connections_mode_stage1 = true
    }
  }

  point2_index = 0
  point2_data = []
  min_x2 = 0
  min_y2 = 0
  min_x_dist2 = 0
  min_y_dist2 = 0

  findSecondPoint(x1, y1) {
    this.point2_data = []
    var min_distance = this.canvas.nativeElement.width * this.canvas.nativeElement.width
    
    var json = JSON.parse(this.MetajsonTxt);
    let points = json["Points"];
    let connections = json["Connections"];
    
    let curr = [];   

    // Check Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        var x2 = curr[0]
        var y2 = curr[1]
        var distance = this.points_distance(x1, y1, x2, y2)
        
        if (distance < min_distance) {
          min_distance = distance
          this.point2_index = i
          this.point2_data = curr
        }
      }

      this.add_connections_mode_stage2 = true

      this.drawLine(this.point1_data[0], this.point1_data[1], this.point2_data[0], this.point2_data[1])

      // Add connection to metadata
      var json = JSON.parse(this.MetajsonTxt);
      var line = json.Connections;
      if (line == undefined)
        json.Connections = [[this.point1_index, this.point2_index]]
      else
        json.Points.push([this.point1_index, this.point2_index])
      this.MetajsonTxt = JSON.stringify(json);
      this.MetaDataText.nativeElement.value = this.MetajsonTxt;
    }
  }



  // Buttons Implementation - START
  EditAnnotationsMode() {
    this.edit_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "EditPosition") {
      // this.OptionSelected(1)

      // Enable Edit Mode
      this.CurrentClicked = "EditPosition";
      this.disableOtherOptions()
      this.CurrentClicked = "EditPosition";
    }
    else {
      this.edit_in_progress = false
      this.DisableEditAnnotationsMode()
      this.CurrentClicked = "";
      //this.ClearAnnotations(false)
    }
  }

  edit_in_progress = false

  DisableEditAnnotationsMode() {
    if (this.add_connections_mode_stage1 == true && this.edit_in_progress == false) {
      this.add_connections_mode_stage1 = false
      this.add_connections_mode_stage2 = false
      this.add_connections_mode_stage3 = false
      this.SendMetaData()
    }
  }

  

  AddConnectionsMode() {
    this.edit_in_progress = true
    this.disappearContext();
    if (this.CurrentClicked != "AddConnection") {

      // Enable Edit Mode
      this.CurrentClicked = "AddConnection";
      this.disableOtherOptions()
      this.CurrentClicked = "AddConnection";
    }
    else {
      this.edit_in_progress = false
      this.DisableAddConnectionsMode()
      this.CurrentClicked = "";
      //this.ClearAnnotations(false)
    }
  }

  DisableAddConnectionsMode() {
    if (this.edit_annotations_mode_stage1 == true && this.edit_in_progress == false) {
      this.edit_annotations_mode_stage1 = false
      this.edit_annotations_mode_stage2 = false
      this.edit_annotations_mode_stage3 = false
      this.SendMetaData()
    }
  }


  ///
  

  CVFunction() {
    this.disappearContext();
    if (this.CurrentClicked != "OpenCV") {
      // this.OptionSelected(3)

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditAnnotationsMode()

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

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditAnnotationsMode()

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
    let points = json["Points"];
    let connections = json["Connections"];

    let curr = [];

    // Draw Points
    if (points != null) {
      for (let i = 0; i < points.length; i++) {
        curr = points[i];
        this.ctx = this.canvas.nativeElement.getContext('2d');

        this.color_point(curr[0], curr[1], 'black', 10);
      }
    }

    if (connections != null) {
      for (let i = 0; i < connections.length; i++) {
        curr = connections[i];
        this.ctx = this.canvas.nativeElement.getContext('2d');

        let point1 = points[curr[0]];
        let point2 = points[curr[1]];

        this.drawLine(point1[0], point1[1], point2[0], point2[1]);
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

  DrawStartingPoint() {
    this.disappearContext();
    if (this.CurrentClicked != "StartingPoint") {

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditAnnotationsMode()

      this.CurrentClicked = "StartingPoint";
      this.disableOtherOptions()
      this.CurrentClicked = "StartingPoint";
    }
    else {
      this.CurrentClicked ="";
      this.textInput.nativeElement.style.display = "none";
    }
  }

  DrawPoint() {
    this.disappearContext();
    if (this.CurrentClicked != "Point") {

      // Disable Edit Mode
      this.edit_in_progress = false
      this.DisableEditAnnotationsMode()

      this.CurrentClicked = "Point";
      this.disableOtherOptions()
      this.CurrentClicked = "Point";
    }
    else {
      this.CurrentClicked ="";
      this.textInput.nativeElement.style.display = "none";
    }
  }

  ClearAnnotations(deleteMetadata:boolean = true){
    // this.OptionSelected(0)

    // Disable Edit Mode
    if (deleteMetadata == true) {
      this.edit_in_progress = false
      this.edit_annotations_mode_stage1 = false
      this.edit_annotations_mode_stage2 = false
      this.edit_annotations_mode_stage3 = false
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



  disappearContext(){
    this.menu.nativeElement.style.display = "none";
  }

  stopPropagation(e: any){
    e.stopPropagation();
  }

  drawLine(x1, y1, x2, y2) {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    //console.log(x1,y1,x2,y2)
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  color_point(x, y, color='green', radius=5) {
    this.ctx = this.canvas.nativeElement.getContext('2d');
    var rect = this.canvas.nativeElement.getBoundingClientRect();

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.fillStyle = 'black';
    this.ctx.stroke();
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
}
