import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";


@Injectable({
    providedIn: 'root'
})
export class FindPathService {
    readonly APIUrl = "http://127.0.0.1:8000";

    constructor(
        private http: HttpClient
    ) { }

    getFindPathResult(jsonParamsData: JSON): Observable<any[]>{
        return this.http.post<any[]>(this.APIUrl + '/findPath/', jsonParamsData);
    }
}