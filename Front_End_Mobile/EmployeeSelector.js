/**
 * @author MOYO CT
 * @version mobile_app
 */

import React, { useState, useEffect } from 'react';
import {View, Text, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet, ActivityIndicator, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import config from './config';

const API_URL = config.API_URL;

//EmployeeSelector component to select an employee to start a new chat with.
const EmployeeSelector = ({ visible, onClose, onSelectEmployee }) => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchEligibleEmployees = async () => {
    try {
      setIsLoading(true);
      const employeeId = await AsyncStorage.getItem('employee_id');
      if (!employeeId) {
        Alert.alert('Error', 'Unable to identify current user');
        return;
      }

      const response = await axios.get(`${API_URL}/api/conversation/eligible/${employeeId}`);
      setEmployees(response.data);
      setFilteredEmployees(response.data);
    } catch (error) {
      //console.error('Error fetching eligible employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchEligibleEmployees();
      setSearchText('');
    }
  }, [visible]);

  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(employee => {
        const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
        const role = employee.role_name ? employee.role_name.toLowerCase() : '';
        const type = employee.type_.toLowerCase();
        const search = searchText.toLowerCase();
        
        return fullName.includes(search) || role.includes(search) || type.includes(search);
      });
      setFilteredEmployees(filtered);
    }
  }, [searchText, employees]);

  const handleSelectEmployee = (employee) => {
    const fullName = `${employee.first_name} ${employee.last_name}`;
    onSelectEmployee({
      employee_id: employee.employee_id,
      name: fullName,
      type: employee.type_,
      role_name: employee.role_name
    });
    onClose();
  };

  const renderEmployeeItem = ({ item }) => {
    const fullName = `${item.first_name} ${item.last_name}`;
    const isManager = item.type_ === 'manager';
    
    return (
      <TouchableOpacity
        style={[styles.employeeItem, isManager && styles.managerItem]}
        onPress={() => handleSelectEmployee(item)}
      >
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{fullName}</Text>
          <View style={styles.employeeDetails}>
            <Text style={styles.employeeRole}>{item.role_name}</Text>
            {isManager && (
              <View style={styles.managerBadge}>
                <Text style={styles.managerBadgeText}>MANAGER</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.chevron}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = () => {
    const managers = filteredEmployees.filter(emp => emp.type_ === 'manager');
    const colleagues = filteredEmployees.filter(emp => emp.type_ !== 'manager');
    
    return (
      <View style={styles.sectionInfo}>
        <Text style={styles.sectionInfoText}>
          {managers.length > 0 && colleagues.length > 0
            ? `${managers.length} manager(s) • ${colleagues.length} colleague(s)`
            : managers.length > 0
            ? `${managers.length} manager(s)`
            : `${colleagues.length} colleague(s)`}
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Start New Chat</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>Loading employees...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {renderSectionHeader()}
            <FlatList
              data={filteredEmployees}
              renderItem={renderEmployeeItem}
              keyExtractor={(item) => item.employee_id.toString()}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    {searchText ? 'No employees match your search' : 'No employees available'}
                  </Text>
                </View>
              }
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchInput: {
    backgroundColor: '#2c2c2c',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionInfo: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginBottom: 8,
  },
  sectionInfoText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2c',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  managerItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  employeeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeRole: {
    color: '#aaa',
    fontSize: 14,
    marginRight: 8,
  },
  managerBadge: {
    backgroundColor: '#007bff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  managerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chevron: {
    paddingLeft: 12,
  },
  chevronText: {
    color: '#666',
    fontSize: 24,
    fontWeight: '300',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default EmployeeSelector;