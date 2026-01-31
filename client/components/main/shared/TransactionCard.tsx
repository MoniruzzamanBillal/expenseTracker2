import { TTransaction } from "@/types/Transaction.tyes";
import { COLORS } from "@/utils/colors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Text } from "react-native-paper";

const typeOptions = {
  income: "income",
  expense: "expense",
};

export default function TransactionCard({
  transactionData,
}: {
  transactionData: TTransaction;
}) {
  // console.log(transactionData);

  //   const { mutateAsync: deleteTransactionData } = useDeleteTransaction();

  // ! for deleting transaction data
  const handleDeleteTransaction = async (transactionData: TTransaction) => {
    // const result = await deleteTransactionData(transactionData?._id!);
    // if (result?.success) {
    //   const successMessage = result?.message;
    //   Toast.show({
    //     type: "success",
    //     text1: successMessage,
    //     position: "top",
    //   });
    // }
  };

  // Left action for swipe right (left-to-right)
  const renderLeftActions = (progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [0, 1],
      extrapolate: "clamp",
    });
    return (
      <Animated.View
        style={[cardStyles.leftAction, { transform: [{ scale }] }]}
      >
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => handleDeleteTransaction(transactionData)}
        >
          <MaterialCommunityIcons name="delete" size={30} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      overshootLeft={false}
      overshootRight={false}
    >
      <View style={cardStyles.container}>
        {/* body section  */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* left title section  */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              width: "74%",
              columnGap: 6,
            }}
          >
            {/* icon section  */}
            <View>
              {transactionData?.type === typeOptions?.income ? (
                <MaterialCommunityIcons
                  name="cash-multiple"
                  size={29}
                  color="green"
                />
              ) : (
                <MaterialCommunityIcons
                  name="cash-minus"
                  size={29}
                  color="red"
                />
              )}
            </View>

            {/* title , description  */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: "700" }}>
                {transactionData?.title}
              </Text>

              <Text
                style={{ fontSize: 13, fontWeight: "600", marginBottom: 3 }}
              >
                {transactionData?.description}
              </Text>
            </View>
          </View>

          {/*  */}
          {/* right money section  */}
          <View
            style={{
              alignItems: "flex-end",
              width: "24%",
            }}
          >
            {/* money section  */}
            <View
              style={{
                flexDirection: "row",
                alignContent: "center",
                justifyContent: "center",
                columnGap: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color:
                    transactionData.type === typeOptions.income
                      ? COLORS.income
                      : COLORS.expense,
                }}
              >
                +৳
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color:
                    transactionData?.type === typeOptions.income
                      ? COLORS.income
                      : COLORS.expense,
                }}
              >
                {transactionData?.amount}
              </Text>
            </View>

            {/* date section  */}
            <Text
              style={{
                fontSize: 11,
                fontWeight: "900",
                color: COLORS.textLight,
              }}
            >
              {format(
                new Date(transactionData?.createdAt as string),
                "dd-MMM-yyy",
              )}
            </Text>
          </View>

          {/*  */}
        </View>
      </View>
    </Swipeable>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    marginVertical: 5,
    flexDirection: "column",
    backgroundColor: COLORS.background,
    padding: 7,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },

  leftAction: {
    width: 70,
    backgroundColor: "red",
    justifyContent: "center",
    alignItems: "center",
  },

  rightAction: {
    width: 70,
    backgroundColor: "green",
    justifyContent: "center",
    alignItems: "center",
  },
});
