import {
  IExecuteFunctions,
} from 'n8n-core';

import {
  IDataObject,
  INodeExecutionData,
} from 'n8n-workflow';

import {
  apiRequest,
} from '../../../transport';

export async function update(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
  const body = {} as IDataObject;
  const requestMethod = 'POST';
  const endPoint = 'employees';
  const companyName = this.getNodeParameter('companyName', index) as string;
  const id = this.getNodeParameter('id', index) as string;
  const fileId = this.getNodeParameter('fileId', index) as string;

  body.name = this.getNodeParameter('name', index) as string;
  body.categoryId = this.getNodeParameter('categoryId', index) as string;
  body.shareWithEmployee = this.getNodeParameter('shareWithEmployee', index) as string;

  const uri = `https://api.bamboohr.com/api/gateway.php/${companyName}/v1/${endPoint}/${id}/files/${fileId}`;
  const responseData = await apiRequest.call(this, requestMethod, uri, body);

  return this.helpers.returnJsonArray(responseData);
}