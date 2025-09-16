
export default {
  data() {
    return {
      startDate: null, // Initialize as null to show the placeholder
      endDate: null // Initialize as null to show the placeholder
    };
  },
  methods: {
    handleInput() {
      // Force update to ensure label visibility reflects input state
      this.$forceUpdate();
    }
  }
};
