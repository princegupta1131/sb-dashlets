import { EventEmitter, Inject, TemplateRef } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { InputParams, IBase, IData, ReportState, IReportType, UpdateInputParams, CustomEvent, IDataService } from '../../types/index';
import { tap } from 'rxjs/operators';
import { constants } from '../../tokens/constants';
import { pick } from 'lodash-es';
import { DATA_SERVICE } from '../../tokens/index';

export abstract class BaseComponent implements Partial<IBase> {

  constructor(@Inject(DATA_SERVICE) protected dataService: IDataService) { }

  id: string;
  templateRefs: Record<string, TemplateRef<any>>;
  $context;
  data = [];
  protected _isInitialized: boolean = false;

  state = new EventEmitter<ReportState>();
  events = new EventEmitter<CustomEvent>();
  eventsSubject: Subject<void> = new Subject<void>();

  abstract inputParameters;
  abstract reportType: IReportType;
  abstract config: object;
  abstract _defaultConfig: object;
  abstract exportOptions: string[];
  abstract initialize(config: InputParams): Promise<any>
  abstract builder(config, data): void;
  abstract reset(): void;
  abstract destroy(): void;
  abstract update(config: UpdateInputParams);
  abstract addData(data: object);
  abstract exportAs(format: string);

  fetchData(config: IData): Observable<any[]> {
    const { values = null, location: { url = null, options = {}, method = 'GET' } = {} } = config || {};
    if (values) return of(values);
    if (!url) throw new Error('invalid input');
    this.state.emit(ReportState.PENDING);
    return this.dataService.fetchData({ method, url, options }).pipe(
      tap(_ => this.state.emit(ReportState.DONE))
    );
  }

  getConfigValue(key: string) {
    return this.config && this.config[key];
  }

  protected checkIfInitialized(): never | void {
    if (!this._isInitialized) {
      throw Error(constants.CHART_NOT_INITIALIZED);
    }
  }

  protected _downloadFile(url, filename) {
    var link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.click();
  }

  getCsv(data, options) {
    return new Promise((resolve, reject) => {
      try {
        const csv = this.convertJsonToCsv(data, options);
        resolve(csv);
      } catch (error) {
        reject(error);
      }
    });
  }
  /**
 * @description  this method is used to convert json to csv 
 * @param {data} any[] json data to be converted into csv
 * @param {oftions} object rename object to change the column label of the csv file
 * 
 */
  convertJsonToCsv(data: any[], oftions: any): string {
    let oftionData = oftions?.rename;
    const header = oftionData ? (oftionData).join(",") + "\n" : Object.keys(data[0]).join(",") + "\n"; // TO Generate the CSV header
    let csvData = header;
    for (const row of data) {
      const values = Object.values(row).map((value: any) => {
        // Check if the value contains commas
        if (typeof value === 'string' && value.includes(',')) {
          // Escape the value by wrapping it in double quotes and replacing any double quotes within the value
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvData += values.join(",") + "\n";
    }
    return csvData;
  }

  async exportAsCsv(data?: object[], options?: Record<string, any>) {
    const { columnsToPick = [], ...others } = options || {};
    const JSON = this.sortAndTransformData(data || this.data, { columnsToPick });
    try {
      const csv: any = await this.getCsv(JSON, others);
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      this._downloadFile(url, 'data.csv');
    } catch (error) {
      console.log(error);
    }
  }

  sortAndTransformData(rows: object[], { columnsToPick = [] }: { columnsToPick: string[] }) {
    if (!columnsToPick.length) return rows;
    return rows.map(row => {
      const defaultValue = columnsToPick.reduce((acc, val) => {
        acc[val] = undefined;
        return acc;
      }, {});
      return pick({ ...defaultValue, ...row }, columnsToPick);
    });
  }


}
