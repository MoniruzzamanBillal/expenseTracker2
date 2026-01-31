import {
  transactionConstants,
  TTransactionType,
} from "@/app/(tabs)/addTransaction";
import { usePatch } from "@/hooks/useApi";
import { TTransaction } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Modal, Portal, Text, TextInput } from "react-native-paper";
import Toast from "react-native-toast-message";

type TPageProps = {
  open: boolean;
  setOpen: (val: boolean) => void;
  initialValue?: TTransaction;
};

export default function UpdateTransactionModal({
  open = false,
  setOpen,
  initialValue,
}: TPageProps) {
  const [type, setType] = useState<TTransactionType>(
    initialValue?.type || transactionConstants.income,
  );

  const [amount, setAmount] = useState<string | null>(
    String(initialValue?.amount) || null,
  );
  const [title, setTitle] = useState<string | null>(
    initialValue?.title || null,
  );
  const [description, setDescription] = useState<string | null>(
    initialValue?.description || null,
  );

  const patchMutation = usePatch([
    ["daily-transaction"],
    ["daily-transaction"],
    ["monthly-transaction-legacy"],
    ["yearly-transaction"],
  ]);

  // * for handling the number input
  const handleTextChange = (text: string) => {
    const regex = /^\d+(\.\d{0,2})?$/; // Accepts integer or up to 2 decimal places

    if (text === "" || regex.test(text)) {
      setAmount(text);
    } else {
      Toast.show({
        type: "error",
        text1: "Invalid Amount",
        text2: "Only numeric values are allowed (e.g. 100 or 50.25)",
        position: "bottom",
      });
      setAmount("");
      return;
    }
  };

  useEffect(() => {
    if (initialValue) {
      setAmount(String(initialValue?.amount));
      setTitle(initialValue?.title);
      setDescription(initialValue?.description ?? " ");
    }
  }, [initialValue]);

  const hideModal = () => setOpen(false);

  // ! for updating
  const handleUpdateTransaction = async () => {
    if (!title?.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Fields",
        text2: "Please title ",
        position: "bottom",
      });

      return;
    }
    if (!amount?.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing Field",
        text2: "Please enter valid amount",
        position: "bottom",
      });

      return;
    }

    try {
      const payload = {
        type,
        amount: parseFloat(amount!),
        title,
        description: description ?? " ",
      };

      const result = await patchMutation.mutateAsync({
        url: `/transactions/update-transaction/${initialValue?._id}`,
        payload,
      });

      // console.log(result);

      if (result?.success) {
        const successMessage = result?.message;
        setTitle("");
        setDescription("");
        setAmount(null);
        setType(transactionConstants?.income);

        Toast.show({
          type: "success",
          text1: successMessage,
          position: "top",
        });

        hideModal();
      }
    } catch (error) {
      console.log("error = ", error);
      Toast.show({
        type: "error",
        text1: "Something went wrong!!",
        position: "top",
      });
      hideModal();
    }
  };

  return (
    <Portal>
      <Modal
        visible={open}
        onDismiss={hideModal}
        contentContainerStyle={styles.modal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <View style={styles.pageWrapper}>
              {/* income , expense button view  */}
              <View
                style={{
                  flexDirection: "row",
                  columnGap: 10,
                  justifyContent: "center",
                }}
              >
                {/* income button  */}
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    type === transactionConstants?.income &&
                      styles.typeButtonActive,
                  ]}
                  onPress={() => setType(transactionConstants?.income)}
                >
                  <MaterialCommunityIcons
                    name="arrow-up"
                    size={18}
                    color={
                      type === transactionConstants?.income
                        ? COLORS.white
                        : "green"
                    }
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === transactionConstants?.income &&
                        styles.typeButtonTextActive,
                    ]}
                  >
                    Income{" "}
                  </Text>
                </TouchableOpacity>

                {/* expense button  */}
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    type === transactionConstants?.expense &&
                      styles.typeButtonActive,
                  ]}
                  onPress={() => setType(transactionConstants?.expense)}
                >
                  <MaterialCommunityIcons
                    name="arrow-down"
                    size={18}
                    color={
                      type === transactionConstants?.expense
                        ? COLORS.white
                        : "red"
                    }
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === transactionConstants?.expense &&
                        styles.typeButtonTextActive,
                    ]}
                  >
                    Expense
                  </Text>
                </TouchableOpacity>

                {/*  */}
              </View>

              {/* horizontal line  */}
              <View
                style={{
                  height: 1,
                  width: "100%",
                  backgroundColor: COLORS.border,
                  margin: 15,
                }}
              />

              {/* money input field  */}
              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                }}
              >
                <TextInput
                  placeholder="+৳ 00.0"
                  keyboardType="numeric"
                  value={amount || ""}
                  onChangeText={handleTextChange}
                  textColor={COLORS.text}
                  style={{
                    borderWidth: 0,
                    backgroundColor: "transparent",
                    padding: 0,
                    fontSize: 15,
                  }}
                />
              </View>

              {/* title input field  */}
              <View
                style={{
                  width: "100%",
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                }}
              >
                <TextInput
                  placeholder="Transaction Title "
                  value={title || ""}
                  onChangeText={setTitle}
                  underlineColorAndroid="transparent"
                  textColor={COLORS.text}
                  style={{
                    borderWidth: 0,
                    backgroundColor: "transparent",
                    padding: 0,
                    fontSize: 15,
                  }}
                />
              </View>

              {/* transaction details input field  */}
              <View
                style={{
                  width: "100%",
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.border,
                }}
              >
                <TextInput
                  placeholder="Transaction Description "
                  value={description || ""}
                  onChangeText={setDescription}
                  textColor={COLORS.text}
                  style={{
                    borderWidth: 0,
                    backgroundColor: "transparent",
                    padding: 0,
                    fontSize: 15,
                  }}
                />
              </View>

              <Button
                disabled={patchMutation?.isPending}
                mode="contained"
                onPress={handleUpdateTransaction}
                style={{ marginTop: 10, backgroundColor: COLORS.primary }}
                labelStyle={{ color: COLORS.background, fontSize: 12 }}
              >
                {patchMutation?.isPending
                  ? "Updating Transaction..."
                  : " Update Transaction"}
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 15,
  },
  modal: {
    backgroundColor: "white",
    padding: 6,
    marginHorizontal: 20,
    borderRadius: 8,
    maxHeight: "90%",
  },

  pageWrapper: {
    width: "90%",
    margin: "auto",

    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 3, // paddingHorizontal: 16,
    elevation: 4,
  },

  typeButton: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    columnGap: 3,
    padding: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  typeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  typeButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "500",
  },

  typeButtonTextActive: {
    color: COLORS.white,
  },
});
