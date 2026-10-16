#import "InttegroModule.h"

#import <Inttegro/Inttegro-Swift.h>
#import <React/RCTUtils.h>

@implementation InttegroModule {
  InttegroPaymentSheetCoordinator *_coordinator;
}

RCT_EXPORT_MODULE(Inttegro)

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _coordinator = [[InttegroPaymentSheetCoordinator alloc] init];
    __weak InttegroModule *weakSelf = self;
    [_coordinator setLifecycleEventHandler:^(NSDictionary *event) {
      NSData *data = [NSJSONSerialization dataWithJSONObject:event
                                                     options:0
                                                       error:nil];
      NSString *payload = data == nil
        ? nil
        : [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      if (payload == nil) {
        return;
      }
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf emitOnPaymentSheetEvent:payload];
      });
    }];
    [_coordinator setTelemetryEventHandler:^(NSDictionary *event) {
      NSData *data = [NSJSONSerialization dataWithJSONObject:event
                                                     options:0
                                                       error:nil];
      NSString *payload = data == nil
        ? nil
        : [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
      if (payload == nil) {
        return;
      }
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf emitOnPaymentSheetTelemetryEvent:payload];
      });
    }];
  }
  return self;
}

- (void)initializePaymentSheet:(NSString *)configurationJson
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  NSData *data = [configurationJson dataUsingEncoding:NSUTF8StringEncoding];
  NSError *jsonError = nil;
  id value = data == nil
    ? nil
    : [NSJSONSerialization JSONObjectWithData:data options:0 error:&jsonError];
  if (![value isKindOfClass:[NSDictionary class]]) {
    reject(
      @"invalid_configuration",
      @"The payment sheet configuration must be a JSON object.",
      jsonError
    );
    return;
  }

  dispatch_async(dispatch_get_main_queue(), ^{
    [self->_coordinator
      initializePaymentSheet:(NSDictionary *)value
      completion:^(NSString *code, NSString *message) {
        if (code != nil) {
          reject(code, message, nil);
          return;
        }
        resolve(nil);
      }];
  });
}

- (void)presentPaymentSheet:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIViewController *presentingViewController = RCTPresentedViewController();
    if (presentingViewController == nil) {
      reject(
        @"presentation_unavailable",
        @"The payment sheet needs an active React Native screen.",
        nil
      );
      return;
    }

    [self->_coordinator
      presentPaymentSheetFrom:presentingViewController
      completion:^(NSDictionary *result, NSString *code, NSString *message) {
        if (code != nil) {
          reject(code, message, nil);
          return;
        }

        NSError *serializationError = nil;
        NSData *data = result == nil
          ? nil
          : [NSJSONSerialization dataWithJSONObject:result
                                             options:0
                                               error:&serializationError];
        NSString *payload = data == nil
          ? nil
          : [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (payload == nil) {
          reject(
            @"invalid_native_result",
            @"The native payment sheet returned an invalid result.",
            serializationError
          );
          return;
        }
        resolve(payload);
      }];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeInttegroSpecJSI>(params);
}

@end
