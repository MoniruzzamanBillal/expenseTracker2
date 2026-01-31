import { StyleSheet, View } from "react-native";
import { Button, Modal, Portal, Text } from "react-native-paper";

type TPageProps = {
  open: boolean;
  setOpen: (val: boolean) => void;
};

export default function UpdateTransactionModal({
  open = false,
  setOpen,
}: TPageProps) {
  const hideModal = () => setOpen(false);

  return (
    <View style={styles.container}>
      <Portal>
        <Modal
          visible={open}
          onDismiss={hideModal}
          contentContainerStyle={styles.modal}
        >
          <Text style={{ marginBottom: 10 }}>This is a Paper Modal</Text>

          <Button onPress={hideModal}>Close</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    backgroundColor: "white",
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 8,
  },
});
