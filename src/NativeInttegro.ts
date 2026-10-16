import {
  TurboModuleRegistry,
  type CodegenTypes,
  type TurboModule,
} from 'react-native';

export interface Spec extends TurboModule {
  initializePaymentSheet(configurationJson: string): Promise<void>;
  presentPaymentSheet(): Promise<string>;
  readonly onPaymentSheetEvent: CodegenTypes.EventEmitter<string>;
  readonly onPaymentSheetTelemetryEvent: CodegenTypes.EventEmitter<string>;
}

export default TurboModuleRegistry.get<Spec>('Inttegro');
