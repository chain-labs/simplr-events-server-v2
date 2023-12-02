export const log = (
  file: string,
  func: string,
  message: any,
  ...optionalParams: Array<any>
) => {
    const currentDateTime = new Date();
    const readableCurrentDateTime = currentDateTime.getHours() + ":" + currentDateTime.getMinutes() + ", "+ currentDateTime.toDateString()
  const header = `Log at ${file}.${func} on ${readableCurrentDateTime}:`;
  console.log(header, message, ...optionalParams);
};

export const logError = (
    file: string,
    func: string,
    message: any,
    ...optionalParams: Array<any>
  ) => {
    const header = `Error at ${file}.${func} on ${new Date()}:`;
    console.error(header, message, ...optionalParams);
  };
